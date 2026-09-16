from pathlib import Path
import json
import math
import random
import sys
import time

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "runtime"))

print("도로 데이터 로딩 중...", flush=True)
load_started = time.perf_counter()

import search_engine as engine


SEED = 20260916
CASES_PER_BAND = 3
MAX_ATTEMPTS = 500_000

# 하한 이상, 상한 미만의 직선거리로 구분한다.
DISTANCE_BANDS = [
    ("매우 짧은 거리", 50, 200),
    ("짧은 거리", 500, 2_000),
    ("중거리", 3_000, 7_000),
    ("장거리", 10_000, 20_000),
    ("약 30킬로미터", 25_000, 35_000),
]

OUTPUT = ROOT / "src" / "tests" / "yen_cases.json"


def main():
    print(
        f"도로 데이터 로딩 완료: "
        f"{time.perf_counter() - load_started:.2f}초"
    )

    # 기존 실험 지점을 실수로 덮어쓰지 않는다.
    if OUTPUT.exists():
        print(f"\n이미 선정 파일이 있습니다: {OUTPUT}")
        print("기존 파일을 유지합니다.")
        return

    rng = random.Random(SEED)

    # 탐색 대상 도로망의 방향을 기준으로 지점을 선정한다.
    # 정렬해서 같은 데이터와 시드로 재현할 수 있도록 한다.
    source_nodes = sorted({
        arc[0] for arc in engine.arcs.values()
    })
    target_nodes = sorted({
        arc[1] for arc in engine.arcs.values()
    })

    if not source_nodes or not target_nodes:
        raise ValueError("테스트 지점을 선택할 도로가 없습니다.")

    groups = {
        name: []
        for name, _, _ in DISTANCE_BANDS
    }

    selected_pairs = set()
    attempts = 0

    print(f"출발 후보 노드: {len(source_nodes):,}개")
    print(f"도착 후보 노드: {len(target_nodes):,}개")
    print("거리대별 무작위 지점 선정 중...", flush=True)

    for attempts in range(1, MAX_ATTEMPTS + 1):
        source = rng.choice(source_nodes)
        target = rng.choice(target_nodes)

        if source == target:
            continue

        if (source, target) in selected_pairs:
            continue

        # 좌표는 미터 단위 투영 좌표이므로 거리도 미터다.
        straight_distance = math.dist(
            engine.xy[source],
            engine.xy[target],
        )

        for name, lower, upper in DISTANCE_BANDS:
            if len(groups[name]) >= CASES_PER_BAND:
                continue

            if lower <= straight_distance < upper:
                groups[name].append({
                    "source": source,
                    "target": target,
                    "straight_distance_m": straight_distance,
                })
                selected_pairs.add((source, target))
                break

        if all(
            len(items) == CASES_PER_BAND
            for items in groups.values()
        ):
            break

    cases = []

    for band_index, (name, lower, upper) in enumerate(
        DISTANCE_BANDS,
        start=1,
    ):
        for case_index, item in enumerate(groups[name], start=1):
            cases.append({
                "case_id": f"{band_index:02d}-{case_index:02d}",
                "band": name,
                "band_min_m": lower,
                "band_max_m": upper,
                **item,
            })

    payload = {
        "seed": SEED,
        "k": 10,
        "selection_attempts": attempts,
        "arc_count": len(engine.arcs),
        "selection_basis": "도로망 투영 좌표의 직선거리",
        "route_existence_checked": False,
        "cases": cases,
    }

    # 새 파일만 생성하며 기존 파일은 덮어쓰지 않는다.
    with OUTPUT.open("x", encoding="utf-8") as file:
        json.dump(
            payload,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print("\n=== 선정된 테스트 지점 ===")

    for case in cases:
        print(
            f"{case['case_id']} | "
            f"{case['band']} | "
            f"출발={case['source']} | "
            f"도착={case['target']} | "
            f"직선거리={case['straight_distance_m']:,.2f}미터"
        )

    print("\n=== 거리대별 선정 개수 ===")

    for name, _, _ in DISTANCE_BANDS:
        count = len(groups[name])
        print(f"{name}: {count}/{CASES_PER_BAND}개")

        if count < CASES_PER_BAND:
            print(
                "  정해진 추출 횟수 안에서 충분히 찾지 못했습니다."
            )

    print(f"\n총 선정 개수: {len(cases)}개")
    print(f"무작위 추출 횟수: {attempts:,}회")
    print(f"저장 위치: {OUTPUT}")
    print("아직 경로 존재 여부와 실제 주행 거리는 확인하지 않았습니다.")


if __name__ == "__main__":
    main()