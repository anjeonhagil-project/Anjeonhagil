from pathlib import Path
import sqlite3


BASE_DIR = Path(__file__).resolve().parents[2]

ROUTING_DB = BASE_DIR / "data" / "routing.sqlite"
CHILD_DB = BASE_DIR / "data" / "child_circle.sqlite"


def main():
    with sqlite3.connect(CHILD_DB) as child_conn:
        child_conn.row_factory = sqlite3.Row

        child_edges = child_conn.execute(
            """
            SELECT
                edge_id,
                inside_circle_length_m,
                intervals_json
            FROM edge_child_circle
            WHERE within_100m = 1
              AND inside_circle_length_m > 0
            ORDER BY edge_id
            """
        ).fetchall()

    with sqlite3.connect(ROUTING_DB) as routing_conn:
        routing_conn.row_factory = sqlite3.Row

        for child in child_edges:
            arcs = routing_conn.execute(
                """
                SELECT
                    arc_id,
                    edge_id,
                    from_node,
                    to_node,
                    length_m
                FROM arcs
                WHERE edge_id = ?
                ORDER BY arc_id
                """,
                (child["edge_id"],),
            ).fetchall()

            if len(arcs) >= 2:
                print(
                    "=== 양방향 CHILD Edge 발견 ==="
                )

                print(f"edge_id: {child['edge_id']}")
                print(
                    f"inside_circle_length_m: "
                    f"{child['inside_circle_length_m']:.2f}m"
                )
                print(
                    f"intervals_json: "
                    f"{child['intervals_json']}"
                )

                print("\n=== Arc 목록 ===")

                for arc in arcs:
                    print(
                        f"arc_id={arc['arc_id']}, "
                        f"from={arc['from_node']}, "
                        f"to={arc['to_node']}, "
                        f"length={arc['length_m']:.2f}m"
                    )

                return

    print("양방향 CHILD Edge를 찾지 못했습니다.")


if __name__ == "__main__":
    main()