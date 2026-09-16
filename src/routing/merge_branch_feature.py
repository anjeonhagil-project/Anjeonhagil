from src.routing.arc_feature_data import get_arc_feature
from src.routing.routing_data import get_arc_by_id


def calculate_merge_branch_feature(
    arc_id,
    traversed_length_m=None,
):
    """
    MERGE_BRANCH 계산

    최종 정의:
        merge_score × 실제 통과 거리(m)

    traversed_length_m이 없으면
    해당 Arc 전체 길이를 통과한 것으로 계산한다.
    """

    feature = get_arc_feature(arc_id)
    arc = get_arc_by_id(arc_id)

    if feature is None:
        return None

    if arc is None:
        return None

    merge_score = feature["merge_score"]

    # 결측값을 임의로 0으로 바꾸지 않음
    if merge_score is None:
        merge_branch_score_m = None

    else:
        if traversed_length_m is None:
            traversed_length_m = arc["length_m"]

        merge_branch_score_m = (
            merge_score * traversed_length_m
        )

    return {
        "arc_id": arc_id,
        "edge_id": arc["edge_id"],
        "arc_length_m": arc["length_m"],
        "traversed_length_m": traversed_length_m,
        "merge_score": merge_score,
        "merge_branch_score_m": merge_branch_score_m,
        "merge_basis": feature["merge_basis"],
        "merge_estimated": feature["merge_estimated"],
        "eligible": feature["eligible"],
    }


if __name__ == "__main__":
    test_arc = 132

    result = calculate_merge_branch_feature(
        test_arc
    )

    print("\n=== MERGE_BRANCH Feature ===")

    if result is None:
        print("Feature 계산 불가")

    else:
        print(f"arc_id: {result['arc_id']}")
        print(f"edge_id: {result['edge_id']}")
        print(
            f"Arc 전체 길이: "
            f"{result['arc_length_m']:.2f}m"
        )
        print(
            f"실제 통과 길이: "
            f"{result['traversed_length_m']:.2f}m"
        )
        print(
            f"merge_score: "
            f"{result['merge_score']}"
        )
        print(
            f"MERGE_BRANCH: "
            f"{result['merge_branch_score_m']:.2f} score·m"
        )
        print(
            f"merge_basis: "
            f"{result['merge_basis']}"
        )
        print(
            f"merge_estimated: "
            f"{result['merge_estimated']}"
        )
        print(
            f"eligible: "
            f"{result['eligible']}"
        )