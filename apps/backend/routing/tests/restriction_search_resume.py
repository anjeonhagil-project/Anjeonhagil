# 예제 경로의 출발·도착 노드로 최단거리 경로를 찾고, 그 중간 상태에서 다시 탐색하는 테스트 파일

from pathlib import Path
import math
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools" / "runtime"))

import json
import search_engine as engine


def main():
    request = json.loads(
        (ROOT / "tools" / "examples" / "hourly_request.json")
        .read_text(encoding="utf-8")
    )

    segments = request["segments"]
    start = engine.arcs[segments[0]["arc_id"]][0]
    target = engine.arcs[segments[-1]["arc_id"]][1]

    cost, path, _, states = engine.search(
        start,
        target,
        "distance",
        return_state_path=True,
    )

    assert len(path) >= 2
    assert len(states) == len(path) + 1

    # 앞부분을 절반 정도 유지한다.
    split = len(path) // 2
    spur_state = states[split]

    suffix_cost, suffix, _, suffix_states = engine.search(
        spur_state[0],
        target,
        "distance",
        initial_state=spur_state,
        return_state_path=True,
    )

    root_cost = sum(
        engine.base["distance"][arc_id]
        for arc_id in path[:split]
    )

    # 동점 경로가 있을 수 있으므로 Arc 목록 대신 비용을 비교한다.
    assert math.isclose(
        root_cost + suffix_cost,
        cost,
        rel_tol=1e-9,
        abs_tol=1e-6,
    )

    assert suffix_states[0] == spur_state

    # 전체 경로를 처음부터 재생해 제한 이력도 확인한다.
    replay_state = states[0]

    for index, arc_id in enumerate(path):
        history = engine.rules.advance(
            replay_state[2],
            arc_id,
        )
        assert history is not None

        replay_state = (
            engine.arcs[arc_id][1],
            arc_id,
            history,
        )
        assert replay_state == states[index + 1]

    print("PASS: 상태 경로 복원")
    print("PASS: 중간 상태에서 탐색 재개")
    print("PASS: 앞부분 + 뒷부분 비용 일치")
    print("PASS: 제한 이력 유지")


if __name__ == "__main__":
    main()
