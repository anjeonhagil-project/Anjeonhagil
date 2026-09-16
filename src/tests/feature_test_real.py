from src.routing.transition_data import get_transition_info
from src.routing.transition_features import extract_transition_features


def print_transition_result(from_arc, to_arc):
    # 1. transitions.sqlite에서 실제 Transition 조회
    transition = get_transition_info(
        from_arc,
        to_arc,
    )

    # DB에 해당 Transition이 없을 경우
    if transition is None:
        print(
            f"Transition 없음: "
            f"{from_arc} -> {to_arc}"
        )
        return

    # 2. 실제 Transition을 운전부담 Feature로 변환
    features = extract_transition_features(
        transition
    )

    # 3. 실제 DB에서 가져온 Transition 정보 출력
    print("\n==============================")

    print(
        f"Transition: "
        f"{from_arc} -> {to_arc}"
    )

    print(
        f"회전각: "
        f"{transition['abs_turn_angle_deg']:.2f}도"
    )

    print(
        f"node_degree: "
        f"{transition['node_degree']}"
    )

    print(
        f"complex_proxy: "
        f"{transition['complex_proxy']}"
    )

    print(
        f"unfamiliar_proxy: "
        f"{transition['unfamiliar_proxy']}"
    )

    # 4. 변환 결과 출력
    print("\n=== 운전 부담 Feature ===")

    print(
        "복잡한 교차로:",
        features["complex_intersection"]
    )

    print(
        "급격한 방향전환:",
        features["unfamiliar_turn"]
    )


if __name__ == "__main__":

    # 실제 DB 사례 1
    # 급격한 방향전환
    print_transition_result(
        3,
        41407,
    )

    # 실제 DB 사례 2
    # 복잡한 교차로
    print_transition_result(
        195,
        7378,
    )