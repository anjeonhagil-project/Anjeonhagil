# 거리별 직선거리로 뽑은 15개를 경로 후보 뽑아보기

from datetime import datetime
from pathlib import Path
import json
import math
import sys
import time


sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]

CASES_FILE = ROOT / "src" / "tests" / "yen_cases.json"

# 실행마다 새 파일을 만들므로 이전 결과를 덮어쓰지 않는다.
RESULT_FILE = (
    ROOT
    / "src"
    / "tests"
    / (
        "yen_k10_distance_results_"
        + datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        + ".json"
    )
)

K = 10
SLOW_CASE_SECONDS = 60.0

sys.path.insert(
    0,
    str(ROOT / "tools" / "runtime"),
)

print("실제 도로 DB 로딩 중...", flush=True)
load_started = time.perf_counter()

import search_engine as engine
from yen import yen_k_shortest


def validate_route(route, source, target):
    """후보 한 개의 거리·연결·제한 이력을 검증한다."""
    path = route["arc_ids"]
    states = route["states"]

    assert path, "빈 후보 경로"
    assert len(states) == len(path) + 1, (
        "상태 수와 Arc 수가 맞지 않습니다."
    )
    assert states[0] == (source, -1, ()), (
        "시작 상태가 맞지 않습니다."
    )
    assert states[-1][0] == target, (
        "목적지 상태가 맞지 않습니다."
    )
    assert len(states) == len(set(states)), (
        "확장 상태가 반복되었습니다."
    )

    calculated_distance = sum(
        engine.arcs[arc_id][2]
        for arc_id in path
    )

    assert math.isclose(
        calculated_distance,
        route["cost"],
        rel_tol=1e-9,
        abs_tol=1e-6,
    ), "거리와 Yen 비용이 일치하지 않습니다."

    for index, arc_id in enumerate(path):
        node, previous_arc, history = states[index]
        arc = engine.arcs[arc_id]

        assert arc[0] == node, (
            f"Arc 연결 오류: {arc_id}"
        )

        if previous_arc != -1:
            assert any(
                next_arc == arc_id
                for next_arc, _, _
                in engine.trans.get(previous_arc, ())
            ), (
                f"Transition 없음: "
                f"{previous_arc} -> {arc_id}"
            )

        next_history = engine.rules.advance(
            history,
            arc_id,
        )

        assert next_history is not None, (
            f"회전 제한 위반: {arc_id}"
        )

        expected_next_state = (
            arc[1],
            arc_id,
            next_history,
        )

        assert states[index + 1] == expected_next_state, (
            f"상태 경로 불일치: {arc_id}"
        )

    nodes = [
        state[0]
        for state in states
    ]

    return {
        "distance_m": calculated_distance,
        "arc_count": len(path),
        "actual_node_revisits": (
            len(nodes) - len(set(nodes))
        ),
        # 전체 Arc 목록을 저장해 최적화 전후에 정확히 비교한다.
        "arc_ids": path,
    }


def save_partial_result(
    load_seconds,
    case_data,
    started_at,
):
    """완료된 사례를 매번 저장해 긴 실행 중에도 결과를 남긴다."""
    payload = {
        "started_at": started_at,
        "saved_at": datetime.now().isoformat(),
        "k": K,
        "database_load_seconds": load_seconds,
        "arc_count": len(engine.arcs),
        "selection_file": str(CASES_FILE),
        "results": case_data,
    }

    temporary_file = RESULT_FILE.with_suffix(".tmp")

    with temporary_file.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            payload,
            file,
            ensure_ascii=False,
            indent=2,
        )

    temporary_file.replace(RESULT_FILE)


def run_case(case):
    """사례 한 개에서 K=10 후보 생성과 검증을 수행한다."""
    started = time.perf_counter()

    result = {
        "case_id": case["case_id"],
        "band": case["band"],
        "source": case["source"],
        "target": case["target"],
        "straight_distance_m": (
            case["straight_distance_m"]
        ),
        "status": "실행 중",
        "candidate_count": 0,
    }

    try:
        routes = yen_k_shortest(
            case["source"],
            case["target"],
            K,
            profile="distance",
            use_h=True,
        )

        elapsed = time.perf_counter() - started

        result["candidate_generation_seconds"] = elapsed

        if not routes:
            result["status"] = "경로 없음"
            return result

        arc_paths = [
            tuple(route["arc_ids"])
            for route in routes
        ]

        assert len(arc_paths) == len(set(arc_paths)), (
            "중복 후보 경로"
        )

        costs = [
            route["cost"]
            for route in routes
        ]

        assert all(
            previous <= current
            for previous, current in zip(
                costs,
                costs[1:],
            )
        ), "후보 비용 정렬 오류"

        candidates = []

        for rank, route in enumerate(
            routes,
            start=1,
        ):
            validated = validate_route(
                route,
                case["source"],
                case["target"],
            )

            candidates.append({
                "rank": rank,
                "cost": route["cost"],
                **validated,
            })

        distances = [
            candidate["distance_m"]
            for candidate in candidates
        ]

        result.update({
            "status": "완료",
            "candidate_count": len(candidates),
            "shortest_route_distance_m": min(distances),
            "longest_route_distance_m": max(distances),
            "max_actual_node_revisits": max(
                candidate["actual_node_revisits"]
                for candidate in candidates
            ),
            "candidates": candidates,
        })

        return result

    except Exception as error:
        result["candidate_generation_seconds"] = (
            time.perf_counter() - started
        )

        if (
            isinstance(error, RuntimeError)
            and str(error) == "search_state_cap"
        ):
            result["status"] = "탐색 상태 한도 초과"
        else:
            result["status"] = "오류"

        result["error_type"] = type(error).__name__
        result["error_message"] = str(error)

        return result


def print_case_result(index, total, result):
    """사례 한 개의 핵심 결과를 출력한다."""
    print(
        f"\n[{index}/{total}] "
        f"{result['case_id']} | "
        f"{result['band']}"
    )

    print(
        f"  직선거리: "
        f"{result['straight_distance_m']:,.2f}m"
    )

    print(
        f"  결과: {result['status']}"
    )

    print(
        f"  후보 생성 시간: "
        f"{result.get('candidate_generation_seconds', 0):.3f}초"
    )

    if result["status"] != "완료":
        if result.get("error_message"):
            print(
                f"  오류 내용: "
                f"{result['error_message']}"
            )
        return

    print(
        f"  생성 후보: "
        f"{result['candidate_count']}/{K}개"
    )

    print(
        f"  실제 최단 경로: "
        f"{result['shortest_route_distance_m']:,.2f}m"
    )

    print(
        f"  실제 최장 후보: "
        f"{result['longest_route_distance_m']:,.2f}m"
    )

    print(
        f"  실제 Node 재방문 최대: "
        f"{result['max_actual_node_revisits']}회"
    )

    if (
        result["candidate_generation_seconds"]
        > SLOW_CASE_SECONDS
    ):
        print(
            f"  주의: {SLOW_CASE_SECONDS:.0f}초를 넘긴 사례입니다."
        )


def print_summary(results):
    """거리대별 성능 요약을 출력한다."""
    print("\n========================================")
    print(" 거리대별 K=10 후보 생성 결과")
    print("========================================")

    grouped = {}

    for result in results:
        grouped.setdefault(
            result["band"],
            [],
        ).append(result)

    for band, items in grouped.items():
        completed = [
            item for item in items
            if item["status"] == "완료"
        ]

        no_route = [
            item for item in items
            if item["status"] == "경로 없음"
        ]

        failed = [
            item for item in items
            if item["status"] not in (
                "완료",
                "경로 없음",
            )
        ]

        times = [
            item["candidate_generation_seconds"]
            for item in completed
        ]

        print(f"\n{band}")
        print(
            f"  완료: {len(completed)}/{len(items)}개 | "
            f"경로 없음: {len(no_route)}개 | "
            f"오류·한도 초과: {len(failed)}개"
        )

        if times:
            print(
                f"  후보 생성 시간: "
                f"평균={sum(times) / len(times):.3f}초 | "
                f"최소={min(times):.3f}초 | "
                f"최대={max(times):.3f}초"
            )

            print(
                f"  K=10을 모두 찾은 사례: "
                f"{sum(
                    item['candidate_count'] == K
                    for item in completed
                )}/{len(completed)}개"
            )

    completed = [
        item for item in results
        if item["status"] == "완료"
    ]

    print("\n전체")
    print(f"  총 사례: {len(results)}개")
    print(f"  완료: {len(completed)}개")
    print(
        f"  경로 없음: "
        f"{sum(
            item['status'] == '경로 없음'
            for item in results
        )}개"
    )
    print(
        f"  오류·한도 초과: "
        f"{sum(
            item['status'] not in (
                '완료',
                '경로 없음',
            )
            for item in results
        )}개"
    )

    if completed:
        slowest = max(
            completed,
            key=lambda item: (
                item["candidate_generation_seconds"]
            ),
        )

        print(
            f"  가장 오래 걸린 완료 사례: "
            f"{slowest['case_id']} | "
            f"{slowest['candidate_generation_seconds']:.3f}초"
        )

    print(f"\n상세 결과 저장 위치: {RESULT_FILE}")


def main():
    load_seconds = time.perf_counter() - load_started
    started_at = datetime.now().isoformat()

    print(f"DB 로딩 완료: {load_seconds:.2f}초")
    print(f"탐색 대상 Arc: {len(engine.arcs):,}개")

    with CASES_FILE.open(
        "r",
        encoding="utf-8",
    ) as file:
        case_payload = json.load(file)

    if case_payload.get("k") != K:
        raise ValueError(
            f"yen_cases.json의 K가 {K}가 아닙니다."
        )

    cases = case_payload.get("cases")

    if not isinstance(cases, list) or len(cases) != 15:
        raise ValueError(
            "15개 테스트 사례가 필요합니다."
        )

    print(f"실행 사례: {len(cases)}개")
    print(f"후보 수: K={K}")
    print(
        "직선거리 기준 순서대로 "
        "짧은 사례부터 실행합니다."
    )

    results = []

    try:
        for index, case in enumerate(
            cases,
            start=1,
        ):
            result = run_case(case)
            results.append(result)

            # 사례 하나가 끝날 때마다 저장한다.
            save_partial_result(
                load_seconds,
                results,
                started_at,
            )

            print_case_result(
                index,
                len(cases),
                result,
            )

    except KeyboardInterrupt:
        print(
            "\n사용자가 실행을 중단했습니다. "
            "완료된 사례 결과는 저장되어 있습니다."
        )

    finally:
        save_partial_result(
            load_seconds,
            results,
            started_at,
        )

        print_summary(results)


if __name__ == "__main__":
    main()