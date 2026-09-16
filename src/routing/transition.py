# 5단계 진행하면서 코드 전체 수정함

from src.routing.routing_state import RoutingState
from src.routing.transition_data import get_transition_info


def move_to_next_arc(state, next_arc):
    """
    현재 RoutingState에서 next_arc를 타고 이동한
    새로운 RoutingState를 생성한다.

    현재 단계에서는:
    - 이전 Arc -> 다음 Arc의 transition 정보 조회
    - 새로운 State 생성

    아직 하지 않는 것:
    - 회전 제한 검사
    - 사용자 선호 비용 계산
    - 조작 종류 판정
    """

    # 현재 Node에서 출발하는 Arc가 맞는지 확인
    if next_arc["from_node"] != state.current_node:
        raise ValueError(
            f"현재 Node {state.current_node}에서 "
            f"Arc {next_arc['arc_id']}로 이동할 수 없습니다."
        )

    # 기본값을 먼저 None으로 설정
    # 출발점은 previous_arc가 없기 때문에
    # transition 정보도 존재하지 않는다.
    transition_info = None

    # 이전 Arc가 있을 때만
    # previous_arc -> next_arc 전이정보 조회
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

    # 아직 이전 조작이 한 번도 없다면
    # 마지막 조작 이후 거리는 무한대 유지
    if state.last_action_type is None:
        new_distance_since_last_action = float("inf")

    else:
        new_distance_since_last_action = (
            state.distance_since_last_action
            + next_arc["length_m"]
        )

    # 새로운 State 생성
    next_state = RoutingState(
        current_node=next_arc["to_node"],

        # 방금 지나온 Arc가
        # 다음 State의 previous_arc가 된다.
        previous_arc=next_arc["arc_id"],

        # restriction 로직은 아직 구현 전
        restriction_state=state.restriction_state,

        distance_since_last_action=new_distance_since_last_action,

        # 조작 판정도 아직 구현 전
        last_action_type=state.last_action_type,
    )

    return next_state, transition_info


if __name__ == "__main__":
    from src.routing.routing_data import get_outgoing_arcs

    # ==========================================
    # 1. 시작 State
    # ==========================================

    state1 = RoutingState(
        current_node=278159482,
        previous_arc=None,
        restriction_state=(),
        distance_since_last_action=float("inf"),
        last_action_type=None,
    )

    print("\n=== State 1 ===")
    print(state1)

    # ==========================================
    # 2. 첫 번째 이동: Arc 2
    # ==========================================

    arcs1 = get_outgoing_arcs(
        state1.current_node
    )

    arc2 = next(
        arc
        for arc in arcs1
        if arc["arc_id"] == 2
    )

    print("\n=== 선택한 첫 번째 Arc ===")
    print(
        f"arc_id={arc2['arc_id']}, "
        f"from={arc2['from_node']}, "
        f"to={arc2['to_node']}, "
        f"length={arc2['length_m']:.2f}m"
    )

    state2, transition1 = move_to_next_arc(
        state1,
        arc2,
    )

    print("\n=== Arc 2 이동 후 State 2 ===")
    print(state2)

    print("\n첫 번째 이동 Transition:")
    print(transition1)

    # ==========================================
    # 3. 현재 Node에서 다음 Arc 후보 확인
    # ==========================================

    arcs2 = get_outgoing_arcs(
        state2.current_node
    )

    print("\n=== 다음 Arc 후보 ===")

    for arc in arcs2:
        print(
            f"arc_id={arc['arc_id']}, "
            f"to={arc['to_node']}, "
            f"length={arc['length_m']:.2f}m"
        )

    # ==========================================
    # 4. 두 번째 이동: Arc 4 선택
    # ==========================================

    arc4 = next(
        arc
        for arc in arcs2
        if arc["arc_id"] == 4
    )

    state3, transition2 = move_to_next_arc(
        state2,
        arc4,
    )

    print("\n=== Arc 4 이동 후 State 3 ===")
    print(state3)

    # ==========================================
    # 5. Arc 2 -> Arc 4 Transition 확인
    # ==========================================

    print("\n=== Arc 2 -> Arc 4 Transition ===")

    print(
        f"회전각: "
        f"{transition2['abs_turn_angle_deg']:.2f}도"
    )

    print(
        f"node_degree: "
        f"{transition2['node_degree']}"
    )

    print(
        f"complex_proxy: "
        f"{transition2['complex_proxy']}"
    )

    print(
        f"unfamiliar_proxy: "
        f"{transition2['unfamiliar_proxy']}"
    )