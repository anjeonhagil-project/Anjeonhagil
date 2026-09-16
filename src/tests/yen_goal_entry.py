from pathlib import Path
from unittest.mock import patch
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "runtime"))

import search_engine as engine
from yen import build_goal_entry_check
from src.tests.restriction_search_boundaries import make_graph


def main():
    with patch.multiple(engine, **make_graph()):
        with patch.object(engine, "rules", engine.Rules([])):
            check = build_goal_entry_check(5)

            start = (3, 20, ())
            other_entry = (4, 40, ())

            assert check(start, set(), set())
            print("통과: 진입 연결이 열려 있으면 탐색 유지")

            # 목적지 진입 도로 30을 막아도 40 → 50이 남아 있다.
            assert check(
                start,
                set(),
                {(start, 30)},
            )
            print("통과: 다른 진입 경로가 남으면 탐색 유지")

            assert not check(
                start,
                set(),
                {
                    (start, 30),
                    (other_entry, 50),
                },
            )
            print("통과: 모든 진입 연결 차단 시 탐색 생략")

            assert not check(
                start,
                {(5, 30, ()), (5, 50, ())},
                set(),
            )
            print("통과: 모든 도착 상태 차단 시 탐색 생략")

            # 다른 상태에서 같은 도로를 차단한 것은 별개다.
            assert check(
                start,
                set(),
                {
                    ((3, -1, ()), 30),
                    (other_entry, 50),
                },
            )
            print("통과: 상태가 다른 연결 차단을 구분")

            # 이전 도로 없이 목적지 옆에서 출발하는 경우
            assert check(
                (4, -1, ()),
                {start, other_entry},
                set(),
            )
            print("통과: 최초 출발의 직접 진입 유지")

        with patch.object(
            engine,
            "rules",
            engine.Rules([(1, "no", (10, 20, 30))]),
        ):
            check = build_goal_entry_check(5)

            # 제한 이력이 가능한 진입은 이 검사만으로 생략하지 않는다.
            assert check(
                (3, 20, ((10, 20),)),
                set(),
                {
                    ((3, 20, ()), 30),
                    ((4, 40, ()), 50),
                },
            )
            print("통과: 제한 이력이 복잡하면 기존 탐색에 위임")


if __name__ == "__main__":
    main()