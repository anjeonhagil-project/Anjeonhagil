# 기능(Anjeonhagil): 실제 HTTP 계산→로컬 SQL view 내보내기를 동결 learning.py의 X8/Y 계약으로 연결해 검사한다.
# 전제: test-routing-foundation.py와 실제 fixture를 인자로 준 test-migration.mjs 실행. 모든 선택/scale은 시험용이며 모델 성능이 아니다.
from pathlib import Path
from copy import deepcopy
import json
import math
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/backend/routing/tools/runtime'))
from learning import FEATURE, make_training_pairs, pair_x8, scaler_hash

data = json.loads((ROOT / '.test-tools/learning-choice-fixture.json').read_text(encoding='utf-8'))
assert data['test_only'] is True
event = data['event']
original = deepcopy(event['snapshots'])
snapshots = deepcopy(original)
scaler = {'scale_version': 'fixture_only_not_fitted', 'feature_version': FEATURE, 'fit_split': 'train', 'fit_manifest_sha256': 'a' * 64, 'values': [60, 1000, 1, 1000, 1000, 1, 1, 100]}
for item in snapshots:
    item.update(exposure_id=event['exposure_id'], displayed=True, departure_at=event['departure_at'], scale_version=scaler['scale_version'], scaler_sha256=scaler_hash(scaler))
choice_keys = ['choice_event_id', 'search_id', 'user_id', 'exposure_id', 'selected_candidate_id', 'chosen_at', 'event_source', 'sample_origin', 'exposed_at', 'displayed_candidate_ids']
choice = {key: event[key] for key in choice_keys}
pairs = make_training_pairs(snapshots, choice, event['profile_weights'], scaler)
assert len(pairs) == len(snapshots) - 1
assert math.isclose(sum(row['sample_weight'] for row in pairs), 1)
assert all(len(row['X']) == 8 and all(math.isfinite(x) for x in row['X']) for row in pairs)
by_id = {item['candidate_id']: item for item in snapshots}
for row in pairs:
    a, b = by_id[row['candidate_a']], by_id[row['candidate_b']]
    reverse = pair_x8(b, a, event['profile_weights'], scaler)
    assert all(math.isclose(x, -y, abs_tol=1e-12) for x, y in zip(row['X'], reverse))
    assert row['Y'] == int(row['candidate_a'] == choice['selected_candidate_id'])
assert original == event['snapshots']
report = {'passed': 6, 'pairs': len(pairs), 'source': 'actual routing / local synthetic user choice / test-only scales', 'trained_model': False}
(ROOT / '.test-tools/learning-contract-result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
