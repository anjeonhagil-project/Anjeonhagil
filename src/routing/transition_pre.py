# from routing_state import RoutingState
from routing.routing_state import RoutingState
from routing.transition_data import get_transition_info

def move_to_next_arc(state, next_arc):
    """
    현재 RoutingState에서 next_arc를 타고 이동한
    새로운 RoutingState를 생성한다.

    아직은:
    - 회전 제한 검사 X
    - 회전각 계산 X
    - 사용자 부담 계산 X

    단순히 상태 이동만 수행한다.
    """

    # 현재 Node에서 출발하는 Arc가 맞는지 확인
    if next_arc["from_node"] != state.current_node:
        raise ValueError(
            f"현재 Node {state.current_node}에서 "
            f"Arc {next_arc['arc_id']}로 이동할 수 없습니다."
        )

    # 아직 이전 조작이 한 번도 없으면
    # 마지막 조작 이후 거리는 의미가 없으므로 무한대 유지
    if state.last_action_type is None:
        new_distance_since_last_action = float("inf")

    else:
        new_distance_since_last_action = (
            state.distance_since_last_action
            + next_arc["length_m"]
        )

        transition_info = None

        # 출발 직후가 아니라면
        # 이전 Arc -> 다음 Arc의 전이정보 조회
        if state.previous_arc is not None:
            transition_info = get_transition_info(
                state.previous_arc,
                next_arc["arc_id"],
            )

            if transition_info is None:
                raise ValueError(
                    f"Transition 정보 없음: "
                    f"{state.previous_arc} -> {next_arc['arc_id']}"
                )

    # 새로운 상태 생성
    next_state = RoutingState(
        current_node=next_arc["to_node"],

        # 방금 지나온 Arc가 다음 상태의 previous_arc가 된다.
        previous_arc=next_arc["arc_id"],

        # 아직 restriction 로직을 만들지 않았으므로 그대로 유지
        restriction_state=state.restriction_state,

        distance_since_last_action=new_distance_since_last_action,

        # 새로운 조작 판정 전이므로 기존 값 유지
        last_action_type=state.last_action_type,
    )

    return next_state, transition_info

if __name__ == "__main__":
    from routing.routing_data import get_outgoing_arcs

    # 출발 상태
    start_state = RoutingState(
        current_node=278159482,
        previous_arc=None,
        restriction_state=(),
        distance_since_last_action=float("inf"),
        last_action_type=None,
    )

    print("\n=== 이동 전 State ===")
    print(start_state)

    # 현재 Node에서 나갈 수 있는 Arc 조회
    outgoing_arcs = get_outgoing_arcs(
        start_state.current_node
    )

    # 테스트를 위해 첫 번째 Arc 선택
    selected_arc = outgoing_arcs[0]

    print("\n=== 선택한 Arc ===")
    print(
        f"arc_id={selected_arc['arc_id']}, "
        f"from={selected_arc['from_node']}, "
        f"to={selected_arc['to_node']}, "
        f"length={selected_arc['length_m']:.2f}m"
    )

    # 새로운 State 생성
    next_state = move_to_next_arc(
        start_state,
        selected_arc
    )

    print("\n=== 이동 후 State ===")
    print(next_state)