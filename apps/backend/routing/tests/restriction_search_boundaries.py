from pathlib import Path
from unittest.mock import patch
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "runtime"))

import search_engine as engine


def make_graph():
    # Arc 값: from, to, length, narrow, merge, child, static_time
    arcs = {
        10: (1, 2, 1.0, 0, 0, 0, 1.0),
        20: (2, 3, 1.0, 0, 0, 0, 1.0),
        30: (3, 5, 1.0, 0, 0, 0, 1.0),
        40: (3, 4, 1.0, 0, 0, 0, 1.0),
        50: (4, 5, 1.0, 0, 0, 0, 1.0),
    }

    return {
        "arcs": arcs,
        "outs": {
            1: [10],
            2: [20],
            3: [30, 40],
            4: [50],
            5: [],
        },
        "trans": {
            10: [(20, 0, 0)],
            20: [(30, 0, 0), (40, 0, 0)],
            40: [(50, 0, 0)],
        },
        "xy": {
            node: (float(node), 0.0)
            for node in range(1, 6)
        },
        "profiles": {"distance": (0, 0, 0, 0, 0)},
        "base": {
            "distance": {
                arc_id: arc[2]
                for arc_id, arc in arcs.items()
            }
        },
    }


def root_state():
    """Arc 10 → 20을 지난 실제 제한 이력을 만든다."""
    history = ()

    for arc_id in (10, 20):
        history = engine.rules.advance(history, arc_id)
        assert history is not None

    return (3, 20, history)


def resume(state, **options):
    return engine.search(
        3,
        5,
        "distance",
        use_h=False,
        initial_state=state,
        return_state_path=True,
        **options,
    )


def expect_no_route(call):
    try:
        call()
    except RuntimeError as error:
        # 탐색 한도 초과 등을 '경로 없음'으로 오인하지 않는다.
        assert str(error) == "no_route_in_supported_graph"
    else:
        raise AssertionError("경로가 없어야 하는데 반환되었습니다.")


def main():
    # 테스트 중에만 메모리의 그래프를 교체한다.
    # with를 벗어나면 원래 객체들이 복원된다.
    with patch.multiple(engine, **make_graph()):

        # 1. 앞부분부터 이어지는 no 제한
        with patch.object(
            engine,
            "rules",
            engine.Rules([(1, "no", (10, 20, 30))]),
        ):
            state = root_state()

            cost, path, _, _ = resume(state)

            assert path == [40, 50]
            assert cost == 2.0

            # 이전 Arc만 유지하고 제한 이력을 지우면
            # 금지된 Arc 30을 선택하게 되는 사례인지도 확인한다.
            _, reset_path, _, _ = resume((3, 20, ()))
            assert reset_path == [30]

            print("PASS: root-spur 경계를 넘는 no 제한")

        # 2. 앞부분부터 이어지는 only 제한
        with patch.object(
            engine,
            "rules",
            engine.Rules([(2, "only", (10, 20, 30))]),
        ):
            state = root_state()

            cost, path, _, _ = resume(state)

            assert path == [30]
            assert cost == 1.0

            # 유일하게 허용된 이동을 차단하면,
            # 금지된 우회로를 반환하지 않고 경로 없음이어야 한다.
            expect_no_route(
                lambda: resume(
                    state,
                    blocked_moves={(state, 30)},
                )
            )

            print("PASS: only 제한과 임시 차단의 동시 적용")

        # 3. 제한이 없는 그래프에서 Yen의 차단 기능 검사
        with patch.object(engine, "rules", engine.Rules([])):
            state = root_state()

            _, baseline, _, _ = resume(state)
            assert baseline == [30]

            # 특정 상태에서 Arc 30으로 나가는 연결을 차단
            _, alternative, _, _ = resume(
                state,
                blocked_moves={(state, 30)},
            )
            assert alternative == [40, 50]

            print("PASS: 연결 차단 시 대체 경로 탐색")

            # 동일 Arc라도 다른 출발 상태의 차단은 적용되면 안 된다.
            _, unaffected, _, _ = resume(
                state,
                blocked_moves={((3, -1, ()), 30)},
            )
            assert unaffected == [30]

            print("PASS: 연결 차단의 상태별 구분")

            # Arc 30을 지난 상태로의 진입 자체를 차단
            _, alternative, _, _ = resume(
                state,
                blocked_states={(5, 30, ())},
            )
            assert alternative == [40, 50]

            print("PASS: 확장 상태 차단")

            # 두 출구를 모두 차단
            expect_no_route(
                lambda: resume(
                    state,
                    blocked_moves={
                        (state, 30),
                        (state, 40),
                    },
                )
            )

            print("PASS: 모든 출구 차단 시 경로 없음")

            # 앞선 호출의 차단이 다음 호출에 남지 않아야 한다.
            _, restored, _, _ = resume(state)
            assert restored == [30]

            print("PASS: 임시 차단이 다음 탐색에 남지 않음")


if __name__ == "__main__":
    main()