from pathlib import Path
import sqlite3


BASE_DIR = Path(__file__).resolve().parents[2]

ROUTING_DB = (
    BASE_DIR
    / "data"
    / "routing.sqlite"
)


def main():
    test_edge_id = 30589

    with sqlite3.connect(ROUTING_DB) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            """
            SELECT
                arc_id,
                edge_id,
                from_node,
                to_node,
                length_m,
                static_eligible,
                raw_access_status
            FROM arcs
            WHERE edge_id = ?
            ORDER BY arc_id
            """,
            (test_edge_id,),
        ).fetchall()

    print(
        f"=== edge_id {test_edge_id}에 해당하는 Arc ==="
    )

    for row in rows:
        print("------------------------------")
        print(f"arc_id: {row['arc_id']}")
        print(f"edge_id: {row['edge_id']}")
        print(f"from_node: {row['from_node']}")
        print(f"to_node: {row['to_node']}")
        print(f"length_m: {row['length_m']:.2f}m")
        print(f"static_eligible: {row['static_eligible']}")
        print(f"access: {row['raw_access_status']}")


if __name__ == "__main__":
    main()