from pathlib import Path
import sqlite3
import json

from src.routing.routing_data import get_arc_by_id


BASE_DIR = Path(__file__).resolve().parents[2]

CHILD_DB = (
    BASE_DIR
    / "data"
    / "child_circle.sqlite"
)


def get_child_circle_feature(edge_id):
    """
    특정 physical edge의 어린이시설 100m 원
    교차 정보를 조회한다.
    """

    with sqlite3.connect(CHILD_DB) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT
                edge_id,
                facility_count,
                within_100m,
                inside_circle_length_m,
                intervals_json
            FROM edge_child_circle
            WHERE edge_id = ?
            """,
            (edge_id,),
        ).fetchone()

    return dict(row) if row else None


def calculate_overlap_fraction(
    start_fraction,
    end_fraction,
    intervals,
):
    """
    실제 주행 구간과 CHILD interval이
    겹치는 비율의 총합을 계산한다.
    """

    total_overlap = 0.0

    for interval_start, interval_end in intervals:
        overlap_start = max(
            start_fraction,
            interval_start,
        )

        overlap_end = min(
            end_fraction,
            interval_end,
        )

        if overlap_start < overlap_end:
            total_overlap += (
                overlap_end - overlap_start
            )

    return total_overlap


def convert_arc_fraction_to_edge_fraction(
    arc_id,
    edge_id,
    start_fraction,
    end_fraction,
):
    """
    Arc 진행 방향 기준 fraction을
    physical edge 기준 fraction으로 변환한다.

    arc_id = 2 * edge_id       -> 정방향
    arc_id = 2 * edge_id + 1   -> 역방향
    """

    reverse = arc_id - (2 * edge_id)

    if reverse == 0:
        return start_fraction, end_fraction

    if reverse == 1:
        edge_start = 1.0 - end_fraction
        edge_end = 1.0 - start_fraction

        return edge_start, edge_end

    raise ValueError(
        f"arc_id={arc_id}, edge_id={edge_id}의 "
        f"방향 관계가 올바르지 않습니다."
    )


def calculate_child_zone_feature(
    arc_id,
    start_fraction=0.0,
    end_fraction=1.0,
):
    """
    Arc의 실제 통과 구간만 대상으로
    CHILD_ZONE_NEARBY를 계산한다.

    start_fraction / end_fraction은 Arc 진행 방향 기준이다.
    역방향 Arc이면 physical edge 기준 fraction으로 변환한 뒤
    child_circle.sqlite의 intervals_json과 겹치는 길이를 계산한다.
    """

    if not (
        0.0 <= start_fraction <= end_fraction <= 1.0
    ):
        raise ValueError(
            "start_fraction과 end_fraction은 "
            "0.0 <= start <= end <= 1.0 이어야 합니다."
        )

    arc = get_arc_by_id(arc_id)

    if arc is None:
        return None

    edge_id = arc["edge_id"]

    child = get_child_circle_feature(edge_id)

    traversed_length_m = (
        arc["length_m"]
        * (end_fraction - start_fraction)
    )

    edge_start_fraction, edge_end_fraction = (
        convert_arc_fraction_to_edge_fraction(
            arc_id,
            edge_id,
            start_fraction,
            end_fraction,
        )
    )

    if child is None:
        return {
            "arc_id": arc_id,
            "edge_id": edge_id,
            "arc_length_m": arc["length_m"],
            "start_fraction": start_fraction,
            "end_fraction": end_fraction,
            "edge_start_fraction": edge_start_fraction,
            "edge_end_fraction": edge_end_fraction,
            "traversed_length_m": traversed_length_m,
            "facility_count": 0,
            "intervals": [],
            "overlap_fraction": 0.0,
            "child_zone_nearby_m": 0.0,
        }

    intervals = json.loads(
        child["intervals_json"]
    )

    overlap_fraction = calculate_overlap_fraction(
        edge_start_fraction,
        edge_end_fraction,
        intervals,
    )

    child_zone_nearby_m = (
        arc["length_m"] * overlap_fraction
    )

    return {
        "arc_id": arc_id,
        "edge_id": edge_id,
        "arc_length_m": arc["length_m"],
        "start_fraction": start_fraction,
        "end_fraction": end_fraction,
        "edge_start_fraction": edge_start_fraction,
        "edge_end_fraction": edge_end_fraction,
        "traversed_length_m": traversed_length_m,
        "facility_count": child["facility_count"],
        "intervals": intervals,
        "overlap_fraction": overlap_fraction,
        "child_zone_nearby_m": child_zone_nearby_m,
    }


if __name__ == "__main__":
    # 역방향 Arc 테스트
    test_arc = 261

    result = calculate_child_zone_feature(
        test_arc,
        start_fraction=0.0,
        end_fraction=0.1,
    )

    print("\n=== CHILD_ZONE_NEARBY Reverse Arc ===")

    if result is None:
        print("Arc 정보를 찾을 수 없습니다.")
    else:
        for key, value in result.items():
            print(f"{key}: {value}")
