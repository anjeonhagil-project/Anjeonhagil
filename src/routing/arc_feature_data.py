from pathlib import Path
import sqlite3


BASE_DIR = Path(__file__).resolve().parents[2]

FEATURE_POLICY_DB = (
    BASE_DIR
    / "data"
    / "feature_policy.sqlite"
)


def get_arc_feature(arc_id):
    """
    feature_policy.sqlite의 arc_policy에서
    특정 Arc의 최종 정책 Feature 정보를 조회한다.
    """

    with sqlite3.connect(FEATURE_POLICY_DB) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT
                arc_id,
                merge_score,
                merge_basis,
                merge_estimated,
                eligible
            FROM arc_policy
            WHERE arc_id = ?
            """,
            (arc_id,),
        ).fetchone()

    return dict(row) if row else None


if __name__ == "__main__":
    test_arc = 132

    feature = get_arc_feature(test_arc)

    print("\n=== Arc Policy Feature ===")

    if feature is None:
        print("Arc Feature 없음")

    else:
        print(f"arc_id: {feature['arc_id']}")
        print(f"merge_score: {feature['merge_score']}")
        print(f"merge_basis: {feature['merge_basis']}")
        print(f"merge_estimated: {feature['merge_estimated']}")
        print(f"eligible: {feature['eligible']}")