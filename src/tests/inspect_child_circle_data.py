from pathlib import Path
import sqlite3


BASE_DIR = Path(__file__).resolve().parents[2]

CHILD_DB = (
    BASE_DIR
    / "data"
    / "child_circle.sqlite"
)


def main():
    with sqlite3.connect(CHILD_DB) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            """
            SELECT
                edge_id,
                facility_count,
                within_100m,
                inside_circle_length_m,
                intervals_json
            FROM edge_child_circle
            WHERE within_100m = 1
              AND inside_circle_length_m > 0
            ORDER BY inside_circle_length_m DESC
            LIMIT 3
            """
        ).fetchall()

    print("=== CHILD_ZONE_NEARBY 실제 데이터 ===")

    for row in rows:
        print("\n------------------------------")
        print(f"edge_id: {row['edge_id']}")
        print(f"facility_count: {row['facility_count']}")
        print(f"within_100m: {row['within_100m']}")
        print(
            f"inside_circle_length_m: "
            f"{row['inside_circle_length_m']:.2f}m"
        )
        print(
            f"intervals_json: "
            f"{row['intervals_json']}"
        )


if __name__ == "__main__":
    main()