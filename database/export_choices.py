# 기능(Anjeonhagil): 현재 DB view에서 실제 노출·선택을 순서대로 JSONL로 내보낸다. 모델 적합이나 원본 snapshot 수정은 하지 않는다.
# 사용: .venv\Scripts\python.exe -X utf8 database/export_choices.py --output .test-tools/choices.jsonl
# 파일에는 사용자/위치 이력이 포함된다. Git에 포함하지 않고 학습용 저장소의 접근 권한을 유지한다.
from pathlib import Path
import argparse
import hashlib
import json
import sys
import psycopg
from manage import connect


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    counts = {'train': 0, 'validation': 0, 'test': 0, 'single_candidate_excluded': 0}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db, db.transaction(), args.output.open('x', encoding='utf-8') as out:
        with db.cursor(name='actual_choices') as cur:
            cur.execute("SELECT * FROM ag_choice_training_events WHERE sample_origin='service' ORDER BY chosen_at,choice_event_id")
            for row in cur:
                snapshots = row['snapshots'] or []
                if len(snapshots) < 2:
                    counts['single_candidate_excluded'] += 1
                    continue
                bucket = int(hashlib.sha256(('split_v1:' + str(row['user_id'])).encode()).hexdigest()[:8], 16) % 10
                split = 'train' if bucket < 6 else 'validation' if bucket < 8 else 'test'
                for snapshot in snapshots:
                    snapshot.update(exposure_id=str(row['exposure_id']), displayed=True, departure_at=row['departure_at'].isoformat())
                keys = ['choice_event_id', 'search_id', 'user_id', 'exposure_id', 'selected_candidate_id', 'chosen_at', 'event_source', 'sample_origin', 'exposed_at', 'displayed_candidate_ids']
                record = {'split': split, 'split_version': 'user_sha256_60_20_20_v1', 'profile_weights': row['profile_weights'], 'snapshots': snapshots, 'choice': {key: row[key] for key in keys}}
                out.write(json.dumps(record, ensure_ascii=False, default=str, allow_nan=False) + '\n')
                counts[split] += 1
    print(json.dumps({'counts': counts, 'output': str(args.output), 'note': 'Fit scales on train only in a separate learning view; an empty split is possible.'}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, FileExistsError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    except psycopg.Error as exc:
        print(f'Choice export failed: {type(exc).__name__}; SQLSTATE={exc.sqlstate or "unavailable"}.', file=sys.stderr)
        sys.exit(1)
