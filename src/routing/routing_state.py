from dataclasses import dataclass


@dataclass(frozen=True)
class RoutingState:
    # 현재 위치한 Node
    current_node: int

    # 현재 Node로 들어오기 직전에 사용한 Arc
    # 출발점에서는 이전 Arc가 없으므로 None
    previous_arc: int | None

    # 회전/진입 제한 시퀀스의 현재 상태
    # 아직 구현 전이므로 일단 빈 tuple 사용
    restriction_state: tuple

    # 마지막 회전·합류·분기 등의 조작 이후 이동한 거리(m)
    distance_since_last_action: float

    # 마지막 조작 종류
    # 이것은 구현 편의를 위해 우리가 추가한 값
    last_action_type: str | None


if __name__ == "__main__":
    start_state = RoutingState(
        current_node=278159482,
        previous_arc=None,
        restriction_state=(),
        # distance_since_last_action=0.0,
        # 출발점에서는 이전에 회전,분기,합류한 적이 없으니까 마지막 조작 후 0m가 아님.
        # 0 이라고 두면 첫 번째 조작을 만났을 때 0m <= 100m (연속조작!) 이라고 판단할 수 있음
        distance_since_last_action=float("inf"),
        last_action_type=None,
    )

    print("\n=== 시작 Routing State ===")
    print(start_state)