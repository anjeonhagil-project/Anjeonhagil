def extract_transition_features(transition_info):
    """
    transition 정보를 운전 부담 feature로 변환한다.

    현재 단계에서 처리하는 feature:
    - complex_intersection
    - unfamiliar_turn

    출발점처럼 transition 정보가 없으면 모두 0.
    """

    if transition_info is None:
        return {
            "complex_intersection": 0,
            "unfamiliar_turn": 0,
        }

    return {
        "complex_intersection": int(
            transition_info["complex_proxy"]
        ),
        "unfamiliar_turn": int(
            transition_info["unfamiliar_proxy"]
        ),
    }


if __name__ == "__main__":

    # 방금 실제 DB에서 확인했던
    # Arc 2 -> Arc 4 transition 예제
    sample_transition = {
        "from_arc": 2,
        "to_arc": 4,
        "via_node": 1378780898,
        "abs_turn_angle_deg": 0.33,
        "node_degree": 3,
        "complex_proxy": 0,
        "unfamiliar_proxy": 0,
    }

    features = extract_transition_features(
        sample_transition
    )

    print("\n=== Transition ===")
    print(
        f"{sample_transition['from_arc']} "
        f"-> "
        f"{sample_transition['to_arc']}"
    )

    print(
        f"회전각: "
        f"{sample_transition['abs_turn_angle_deg']}도"
    )

    print("\n=== 운전 부담 Feature ===")

    print(
        "복잡한 교차로:",
        features["complex_intersection"]
    )

    print(
        "급격한 방향전환:",
        features["unfamiliar_turn"]
    )