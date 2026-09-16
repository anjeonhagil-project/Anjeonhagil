from pathlib import Path
import json
import math
import sys
import time
from unittest.mock import patch
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "runtime"))

print("실제 도로 DB 로딩 중...", flush=True)
load_started = time.perf_counter()

import search_engine as engine
from yen import yen_k_shortest
from collections import Counter
from itertools import combinations

from src.tests.full_algorithm_regression import calculate_route_raw6
from src.routing.personalized_burden import (
    FEATURE_NAMES,
    calculate_survey_weights,
    calculate_personalized_burden,
)

def evaluate_candidates(routes):
    started = time.perf_counter()

    # 예시 선호:
    # 좁은 도로 1순위, 복잡한 교차로 2순위,
    # 어린이시설 주변 3순위
    ranks = [2, 0, 1, 0, 0, 3]
    weights = calculate_survey_weights(ranks)

    evaluated = []

    print("\n=== 후보별 Feature 평가 ===")
    print(f"예시 사용자 순위: {ranks}")
    print(f"사용자 가중치: {[round(w, 4) for w in weights]}")

    for index, route in enumerate(routes, start=1):
        segments = [
            {"arc_id": arc_id}
            for arc_id in route["arc_ids"]
        ]

        raw6 = calculate_route_raw6(segments)

        if len(raw6) != 6 or any(
            value is None
            or not math.isfinite(value)
            or value < 0
            for value in raw6
        ):
            raise ValueError(
                f"후보 {index}: 유효하지 않은 Feature {raw6}"
            )

        result = calculate_personalized_burden(
            raw6,
            weights,
        )

        score = result["personalized_burden_score"]
        distance = sum(
            engine.arcs[aid][2]
            for aid in route["arc_ids"]
        )

        evaluated.append({
            "candidate": index,
            "raw6": raw6,
            "score": score,
            "distance": distance,
        })

        print(f"\n후보 {index}")

        for name, value in zip(FEATURE_NAMES, raw6):
            print(f"  {name}: {value:.6f}")

        print(f"  개인화 부담점수: {score:.8f}")

    print("\n=== 후보별 Feature 차이 ===")

    for position, name in enumerate(FEATURE_NAMES):
        values = [
            item["raw6"][position]
            for item in evaluated
        ]
        print(
            f"{name}: "
            f"최소={min(values):.6f}, "
            f"최대={max(values):.6f}, "
            f"차이={max(values) - min(values):.6f}"
        )

    print("\n=== 같은 방향 Arc의 거리 기준 겹침률 ===")

    for left, right in combinations(range(len(routes)), 2):
        left_counts = Counter(routes[left]["arc_ids"])
        right_counts = Counter(routes[right]["arc_ids"])

        # 반복 통과가 있다면 양쪽의 공통 통과 횟수만 계산한다.
        common_counts = left_counts & right_counts

        shared_distance = sum(
            engine.arcs[aid][2] * count
            for aid, count in common_counts.items()
        )

        left_distance = evaluated[left]["distance"]
        right_distance = evaluated[right]["distance"]

        # 거리로 가중한 Jaccard 비율
        union_distance = (
            left_distance + right_distance - shared_distance
        )

        overlap = (
            shared_distance / union_distance
            if union_distance > 0
            else 1.0
        )

        print(
            f"후보 {left + 1} ↔ 후보 {right + 1}: "
            f"겹침률={overlap:.2%}, "
            f"공통 거리={shared_distance:.2f}m"
        )

    # 점수가 정확히 같으면 짧은 거리, 후보 번호 순으로 정렬한다.
    ranked = sorted(
        evaluated,
        key=lambda item: (
            item["score"],
            item["distance"],
            item["candidate"],
        ),
    )

    print("\n=== 예시 선호 기준 순위 ===")

    for rank, item in enumerate(ranked, start=1):
        print(
            f"{rank}위: 후보 {item['candidate']} | "
            f"점수={item['score']:.8f} | "
            f"거리={item['distance']:.2f}m"
        )

    minimum = ranked[0]["score"]
    tied = [
        item["candidate"]
        for item in evaluated
        if math.isclose(
            item["score"],
            minimum,
            rel_tol=1e-9,
            abs_tol=1e-12,
        )
    ]

    print(f"\n최소 점수와 수치상 동점인 후보: {tied}")
    print(
        f"Feature 평가 및 비교 시간: "
        f"{time.perf_counter() - started:.2f}초"
    )
    print("PASS: 모든 후보의 6개 Feature 계산 완료")
def analyze_failed_searches(records):
    """오래 걸린 실패 호출의 조건과 출발 지점 연결을 확인한다."""
    failed = sorted(
        (
            item for item in records
            if item["status"] == "경로 없음"
        ),
        key=lambda item: item["seconds"],
        reverse=True,
    )

    if not failed:
        print("\n실패한 탐색이 없습니다.")
        return

    # 이번 실행은 모두 같은 거리 기준과 탐색 설정을 사용한다.
    # 시작 상태·목적지·차단 집합까지 같아야 동일 조건으로 묶는다.
    groups = {}

    for item in failed:
        key = (
            item["initial_state"],
            item["target"],
            item["blocked_state_set"],
            item["blocked_move_set"],
        )
        groups.setdefault(key, []).append(item)

    print("\n=== 실패 탐색의 동일 조건 비교 ===")
    print(f"실패 호출 수: {len(failed)}회")
    print(f"서로 다른 조건 수: {len(groups)}개")
    print(
        f"동일 조건의 추가 반복 수: "
        f"{len(failed) - len(groups)}회"
    )

    duplicate_groups = [
        items for items in groups.values()
        if len(items) > 1
    ]

    for items in sorted(
        duplicate_groups,
        key=lambda items: sum(
            item["seconds"] for item in items
        ),
        reverse=True,
    )[:10]:
        print(
            f"동일 조건 호출 번호: "
            f"{[item['call'] for item in items]} | "
            f"합계 시간: "
            f"{sum(item['seconds'] for item in items):.3f}초"
        )

    print("\n=== 느린 실패 호출 상세 상위 10개 ===")

    # 목적지 진입 도로 목록은 목적지별 한 번만 만든다.
    incoming_cache = {}

    for item in failed[:10]:
        state = item["initial_state"]
        node, previous_arc, history = state
        target = item["target"]
        blocked_states = item["blocked_state_set"]
        blocked_moves = item["blocked_move_set"]

        print(
            f"\n호출 {item['call']} "
            f"({item['seconds']:.3f}초)"
        )
        print(f"  시작 상태: {state}")
        print(f"  목적지 노드: {target}")
        print(f"  차단 상태 수: {len(blocked_states)}개")
        print(f"  차단 상태 목록: {sorted(blocked_states)}")

        print("  차단 연결 목록:")

        for blocked_state, aid in sorted(blocked_moves):
            arc = engine.arcs[aid]

            print(
                f"    상태 {blocked_state}에서 "
                f"도로 {aid}로 이동 차단 | "
                f"{arc[0]} → {arc[1]} | "
                f"목적지 진입 도로: "
                f"{'예' if arc[1] == target else '아니오'}"
            )

        if target not in incoming_cache:
            incoming_cache[target] = [
                (aid, arc[0])
                for aid, arc in engine.arcs.items()
                if arc[1] == target
            ]

        print(
            "  도로망의 목적지 진입 도로 "
            "(도로 번호, 출발 노드): "
            f"{incoming_cache[target]}"
        )

        if previous_arc == -1:
            choices = [
                (aid, 0, 0)
                for aid in engine.outs[node]
            ]
        else:
            choices = engine.trans.get(previous_arc, ())

        allowed_count = 0
        print("  시작 상태에서 다음 이동 검사:")

        for aid, _, _ in choices:
            arc = engine.arcs[aid]
            next_history = engine.rules.advance(history, aid)
            reasons = []

            if (state, aid) in blocked_moves:
                reasons.append("연결 차단")

            if next_history is None:
                reasons.append("회전 제한")
            else:
                next_state = (
                    arc[1],
                    aid,
                    next_history,
                )
                if next_state in blocked_states:
                    reasons.append("상태 차단")

            if reasons:
                decision = " / ".join(reasons)
            else:
                decision = "이동 가능"
                allowed_count += 1

            print(
                f"    도로 {aid}: "
                f"{arc[0]} → {arc[1]} | {decision}"
            )

        print(f"  시작 지점에서 허용된 이동: {allowed_count}개")


def measure_yen(source, target, k):
    """후보 생성 중 내부 탐색의 실행 시간을 측정한다."""
    original_search = engine.search
    records = []

    def measured_search(*args, **kwargs):
        started = time.perf_counter()

        record = {
            "call": len(records) + 1,
            "source": args[0],
            "blocked_moves": len(
                kwargs.get("blocked_moves") or ()
            ),
            "status": "실행 중",
            "expanded": None,
        }

        # 원래 자료를 변경하지 않고 이번 호출의 조건을 보관한다.
        record["initial_state"] = kwargs.get(
            "initial_state",
            (args[0], -1, ()),
        )
        record["target"] = args[1]
        record["blocked_state_set"] = frozenset(
            kwargs.get("blocked_states") or ()
        )
        record["blocked_move_set"] = frozenset(
            kwargs.get("blocked_moves") or ()
        )

        try:
            result = original_search(*args, **kwargs)

            record["status"] = "경로 발견"
            record["expanded"] = result[2]

            return result

        except Exception as error:
            if (
                isinstance(error, RuntimeError)
                and str(error) == "no_route_in_supported_graph"
            ):
                record["status"] = "경로 없음"
            else:
                record["status"] = "오류 발생"

            # 원래 오류를 그대로 전달한다.
            raise

        finally:
            record["seconds"] = (
                time.perf_counter() - started
            )
            records.append(record)

    started = time.perf_counter()

    try:
        # 이 구간에서만 실제 탐색 함수를 측정 함수로 감싼다.
        # 구간을 벗어나면 원래 탐색 함수로 복원된다.
        with patch.object(engine, "search", measured_search):
            return yen_k_shortest(
                source,
                target,
                k,
                profile="distance",
                use_h=True,
            )

    finally:
        elapsed = time.perf_counter() - started

        search_seconds = sum(
            item["seconds"]
            for item in records
        )

        successful = [
            item for item in records
            if item["status"] == "경로 발견"
        ]

        failed = [
            item for item in records
            if item["status"] == "경로 없음"
        ]

        errors = [
            item for item in records
            if item["status"] == "오류 발생"
        ]

        print("\n=== 후보 생성 내부 탐색 측정 ===")
        print(f"후보 생성 전체 시간: {elapsed:.3f}초")
        print(f"내부 탐색 호출 수: {len(records)}회")
        print(f"경로 발견: {len(successful)}회")
        print(f"경로 없음: {len(failed)}회")
        print(f"오류 발생: {len(errors)}회")

        print(
            f"내부 탐색 총시간: "
            f"{search_seconds:.3f}초"
        )

        print(
            "경로 없음으로 끝난 탐색 시간: "
            f"{sum(r['seconds'] for r in failed):.3f}초"
        )

        print(
            "내부 탐색 외 시간(측정 처리 포함): "
            f"{max(0.0, elapsed - search_seconds):.3f}초"
        )

        print(
            "성공한 탐색의 확장 상태 수 합계: "
            f"{sum(r['expanded'] for r in successful):,}개"
        )

        print("\n=== 가장 오래 걸린 호출 10개 ===")

        slowest = sorted(
            records,
            key=lambda item: item["seconds"],
            reverse=True,
        )[:10]

        for item in slowest:
            expanded = (
                f"{item['expanded']:,}개"
                if item["expanded"] is not None
                else "확인 불가"
            )

            print(
                f"호출={item['call']} | "
                f"시간={item['seconds']:.3f}초 | "
                f"결과={item['status']} | "
                f"확장 상태={expanded} | "
                f"출발 노드={item['source']} | "
                f"차단 연결={item['blocked_moves']}개"
            )
        analyze_failed_searches(records)

def main():
    print(
        f"DB 로딩 완료: "
        f"{time.perf_counter() - load_started:.2f}초",
        flush=True,
    )
    print(f"탐색 대상 Arc: {len(engine.arcs):,}개")

    # 기존 예제에서 출발·도착 Node만 가져온다.
    # 예제의 중간 경로를 따라가도록 강제하지 않는다.
    request = json.loads(
        (ROOT / "tools" / "examples" / "route_request.json")
        .read_text(encoding="utf-8")
    )

    segments = request["segments"]
    first_arc = segments[0]["arc_id"]
    last_arc = segments[-1]["arc_id"]

    source = engine.arcs[first_arc][0]
    target = engine.arcs[last_arc][1]
    k = 10


    print(f"출발 Node: {source}")
    print(f"도착 Node: {target}")
    print(f"거리 기준 Yen K={k} 탐색 시작...", flush=True)

    started = time.perf_counter()

    routes = measure_yen(source, target, k)

    elapsed = time.perf_counter() - started

    print(f"\n전체 후보 생성 시간: {elapsed:.2f}초")
    print(f"발견한 후보: {len(routes)}개")

    if not routes:
        print("현재 지원 도로망에서 경로를 찾지 못했습니다.")
        return

    assert len({
        tuple(route["arc_ids"])
        for route in routes
    }) == len(routes), "중복 경로"

    costs = [route["cost"] for route in routes]
    assert costs == sorted(costs), "비용 정렬 오류"

    for index, route in enumerate(routes, start=1):
        path = route["arc_ids"]
        states = route["states"]

        distance = sum(
            engine.arcs[arc_id][2]
            for arc_id in path
        )

        assert math.isclose(
            distance,
            route["cost"],
            rel_tol=1e-9,
            abs_tol=1e-6,
        ), "거리와 탐색 비용 불일치"

        assert len(states) == len(path) + 1
        assert len(states) == len(set(states)), (
            "확장 상태 반복"
        )
        assert states[0] == (source, -1, ())
        assert states[-1][0] == target

        # 전체 경로의 연결과 제한 이력을 다시 확인한다.
        for step, arc_id in enumerate(path):
            node, previous_arc, history = states[step]
            arc = engine.arcs[arc_id]

            assert arc[0] == node, "도로 연결 오류"

            if previous_arc != -1:
                assert any(
                    next_arc == arc_id
                    for next_arc, _, _
                    in engine.trans.get(previous_arc, ())
                ), "허용되지 않은 전이"

            next_history = engine.rules.advance(
                history,
                arc_id,
            )
            assert next_history is not None, "회전 제한 위반"

            assert states[step + 1] == (
                arc[1],
                arc_id,
                next_history,
            ), "상태 경로 불일치"

        # 확장 상태와 별개로 실제 Node의 재방문을 집계한다.
        nodes = [state[0] for state in states]
        revisits = len(nodes) - len(set(nodes))

        print(f"\n후보 {index}")
        print(f"  거리: {distance:,.2f}m")
        print(f"  최단 후보 대비 추가 거리: {distance - costs[0]:,.2f}m")
        print(f"  Arc 개수: {len(path)}")
        print(f"  실제 Node 재방문 횟수: {revisits}")
        print(f"  Arc 앞 10개: {path[:10]}")

    print("\nPASS: 후보 중복 없음 및 비용순 정렬")
    print("PASS: 거리·연결·회전 제한·상태 경로 확인")
    evaluate_candidates(routes)


if __name__ == "__main__":
    main()