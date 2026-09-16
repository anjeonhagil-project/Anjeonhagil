from pathlib import Path
import sqlite3


BASE_DIR = Path(__file__).resolve().parents[2]

FEATURE_POLICY_DB = (
    BASE_DIR
    / "data"
    / "feature_policy.sqlite"
)


def get_edge_feature(edge_id):
    """
    feature_policy.sqlite의 edge_policy에서
    특정 physical edge의 NARROW_ROAD 관련 정책값을 조회한다.
    """

    with sqlite3.connect(FEATURE_POLICY_DB) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT
                edge_id,
                narrow_score,
                basis,
                is_estimated,
                reference_width_m,
                geometry_width_m,
                address_width_raw,
                eligible,
                lanes_total,
                lane_count_basis,
                lane_band,
                road_context,
                oneway_dir
            FROM edge_policy
            WHERE edge_id = ?
            """,
            (edge_id,),
        ).fetchone()

    return dict(row) if row else None


if __name__ == "__main__":
    test_edge = 933

    feature = get_edge_feature(test_edge)

    print("\n=== NARROW_ROAD Edge Policy ===")

    if feature is None:
        print("Edge Feature 없음")

    else:
        for key, value in feature.items():
            print(f"{key}: {value}")