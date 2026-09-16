# 작은 그래프의 가능한 경로를 DFS로 전부 구하고, Yen 결과와 비교
from pathlib import Path
from unittest.mock import patch
import math
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "runtime"))

import search_engine as engine
from yen import yen_k_shortest


def make_graph():
    # 두 갈래 경로와 2 ↔ 3 순환이 있는 그래프
    #
    # 1 → 2 → 4
    #  └→ 3 → 4
    #     2 ↔ 3
    #
    # 모든 Arc의 비용은 1이다.
    links = {
        10: (1, 2),
        20: (2, 4),
        30: (1, 3),
        40: (3, 4),
        50: (2, 3),
        60: (3, 2),
    }

    arcs = {
        aid: (start, end, 1.0, 0, 0, 0, 1.0)
        for aid, (start, end) in links.items()
    }

    outs = {node: [] for node in range(1, 5)}
    for aid, (start, _) in links.items():
        outs[start].append(aid)

    trans = {
        aid: [
            (next_arc, 0, 0)
            for next_arc in outs[end]
        ]
        for aid, (_, end) in links.items()
    }

    xy = {
        1: (0.0, 0.0),
        2: (1.0, 0.0),
        3: (0.0, 1.0),
        4: (1.0, 1.0),
    }

    # 실제 Arc 비용보다 커지지 않는 휴리스틱 배율
    lower_bound = min(
        1.0 / math.dist(xy[start], xy[end])
        for start, end in links.values()
    )

    return {
        "arcs": arcs,
        "outs": outs,
        "trans": trans,
        "xy": xy,
        "profiles": {"distance": (0, 0, 0, 0, 0)},
        "base": {
            "distance": {aid: 1.0 for aid in arcs}
        },
        "mins": {"distance": lower_bound},
    }


def enumerate_all_paths(source, target):
    """
    최단경로 함수를 사용하지 않고 DFS로 전부 열거한다.

    기준:
    - 확장 상태 반복 금지
    - 목적지에 처음 도착하면 종료
    - no/only 제한 준수
    """
    results = {}
    start_state = (source, -1, ())

    def visit(state, path, states, visited, cost):
        node, previous_arc, history = state

        if node == target:
            results[tuple(path)] = (cost, tuple(states))
            return

        if previous_arc == -1:
            choices = [
                (aid, 0, 0)
                for aid in engine.outs[node]
            ]
        else:
            choices = engine.trans.get(previous_arc, ())

        for aid, _, _ in choices:
            next_history = engine.rules.advance(history, aid)
            if next_history is None:
                continue

            next_state = (
                engine.arcs[aid][1],
                aid,
                next_history,
            )

            if next_state in visited:
                continue

            visit(
                next_state,
                path + [aid],
                states + [next_state],
                visited | {next_state},
                cost + engine.base["distance"][aid],
            )

    visit(
        start_state,
        [],
        [start_state],
        {start_state},
        0.0,
    )

    return results


def compare_with_yen(expected):
    expected_costs = sorted(
        cost for cost, _ in expected.values()
    )

    # K가 후보 수보다 작은 경우와 큰 경우를 모두 검사한다.
    for use_h in (False, True):
        for k in sorted({1, 2, 3, len(expected) + 2}):
            routes = yen_k_shortest(
                1,
                4,
                k,
                profile="distance",
                use_h=use_h,
            )

            keys = [
                tuple(route["arc_ids"])
                for route in routes
            ]

            assert len(keys) == len(set(keys)), (
                "중복 경로",
                keys,
            )

            actual_costs = [
                route["cost"] for route in routes
            ]

            # 동점 후보끼리의 순서는 강제하지 않는다.
            assert actual_costs == expected_costs[:k], (
                "상위 K개 비용 불일치",
                use_h,
                k,
                actual_costs,
                expected_costs[:k],
            )

            for route, key in zip(routes, keys):
                assert key in expected, (
                    "DFS에 없는 경로",
                    key,
                )

                expected_cost, expected_states = expected[key]

                assert route["cost"] == expected_cost
                assert tuple(route["states"]) == expected_states
                assert len(route["states"]) == len(
                    set(route["states"])
                )

            # 충분히 큰 K에서는 모든 경로가 나와야 한다.
            if k >= len(expected):
                assert set(keys) == set(expected), (
                    "전체 경로 집합 불일치"
                )


def main():
    graph = make_graph()

    with patch.multiple(engine, **graph):
        with patch.object(engine, "rules", engine.Rules([])):
            expected = enumerate_all_paths(1, 4)

            # 직접 셀 수 있는 전체 경로 수와도 비교한다.
            assert len(expected) == 6

            shortest = [
                path
                for path, (cost, _) in expected.items()
                if cost == 2.0
            ]
            assert set(shortest) == {
                (10, 20),
                (30, 40),
            }

            # 실제 Node 재방문은 있지만 확장 상태는 반복하지 않는 경로
            assert (10, 50, 60, 20) in expected

            compare_with_yen(expected)

            print("PASS: 순환 그래프 전체 6개 경로 일치")
            print("PASS: 동점 최단경로 누락·중복 없음")
            print("PASS: 확장 상태 반복 없음")

        # 10 → 50 → 40으로 이어지는 이동 금지
        with patch.object(
            engine,
            "rules",
            engine.Rules([(1, "no", (10, 50, 40))]),
        ):
            expected = enumerate_all_paths(1, 4)

            assert (10, 50, 40) not in expected
            assert (10, 50, 60, 20) in expected

            compare_with_yen(expected)
            print("PASS: no 제한 적용 후 전체 열거 결과 일치")

        # Arc 10으로 들어왔으면 다음은 Arc 20만 허용
        with patch.object(
            engine,
            "rules",
            engine.Rules([(2, "only", (10, 20))]),
        ):
            expected = enumerate_all_paths(1, 4)

            assert (10, 20) in expected
            assert not any(
                path[:2] == (10, 50)
                for path in expected
            )

            compare_with_yen(expected)
            print("PASS: only 제한 적용 후 전체 열거 결과 일치")

    print("PASS: 모든 사례의 상위 K개 비용 및 A*/Dijkstra 비교")


if __name__ == "__main__":
    main()

