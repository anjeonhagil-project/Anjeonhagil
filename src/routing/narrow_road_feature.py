from src.routing.edge_feature_data import get_edge_feature
from src.routing.routing_data import get_arc_by_id


def calculate_narrow_road_feature(
    arc_id,
    traversed_length_m=None,
):
    """
    NARROW_ROAD 계산

    최종 정의:
        narrow_score × 실제 통과 거리(m)

    traversed_length_m이 없으면
    Arc 전체 길이를 통과한 것으로 계산한다.
    """

    arc = get_arc_by_id(arc_id)

    if arc is None:
        return None

    edge_feature = get_edge_feature(
        arc["edge_id"]
    )

    if edge_feature is None:
        return None

    narrow_score = edge_feature["narrow_score"]

    # 결측값은 임의로 0으로 처리하지 않음
    if narrow_score is None:
        narrow_road_score_m = None

    else:
        if traversed_length_m is None:
            traversed_length_m = arc["length_m"]

        narrow_road_score_m = (
            narrow_score * traversed_length_m
        )

    return {
        "arc_id": arc_id,
        "edge_id": arc["edge_id"],
        "arc_length_m": arc["length_m"],
        "traversed_length_m": traversed_length_m,
        "narrow_score": narrow_score,
        "narrow_road_score_m": narrow_road_score_m,
        "basis": edge_feature["basis"],
        "is_estimated": edge_feature["is_estimated"],
        "lanes_total": edge_feature["lanes_total"],
        "lane_band": edge_feature["lane_band"],
        "road_context": edge_feature["road_context"],
        "eligible": edge_feature["eligible"],
    }


if __name__ == "__main__":
    # edge_id=933의 Arc 후보
    test_edge_id = 933

    candidate_arc_ids = [
        2 * test_edge_id,
        2 * test_edge_id + 1,
    ]

    test_arc = None

    for arc_id in candidate_arc_ids:
        if get_arc_by_id(arc_id) is not None:
            test_arc = arc_id
            break

    if test_arc is None:
        print("테스트 가능한 Arc를 찾지 못했습니다.")

    else:
        result = calculate_narrow_road_feature(
            test_arc
        )

        print("\n=== NARROW_ROAD Feature ===")

        if result is None:
            print("Feature 계산 불가")

        else:
            for key, value in result.items():
                print(f"{key}: {value}")