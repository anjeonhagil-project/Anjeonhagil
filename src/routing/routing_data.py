from pathlib import Path
import sqlite3

# 프로젝트 루트
BASE_DIR = Path(__file__).resolve().parents[2]

# routing.sqlite 위치
ROUTING_DB = BASE_DIR / "data" / "routing.sqlite"
# print("DB 경로:", ROUTING_DB)
# print("DB 존재 여부:", ROUTING_DB.exists())

def get_outgoing_arcs(node_id):
    """
    특정 node에서 출발할 수 있는 arc 목록을 반환한다.
    """

    with sqlite3.connect(ROUTING_DB) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            """
            SELECT
                arc_id,
                edge_id,
                osm_way_id,
                from_node,
                to_node,
                length_m,
                static_eligible,
                raw_access_status
            FROM arcs
            WHERE from_node = ?
              AND static_eligible = 1
            ORDER BY arc_id
            """,
            (node_id,),
        ).fetchall()

    return [dict(row) for row in rows]

def get_arc_by_id(arc_id):
    """
    arc_id로 특정 Arc 정보를 조회한다.
    """

    with sqlite3.connect(ROUTING_DB) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT
                arc_id,
                edge_id,
                osm_way_id,
                from_node,
                to_node,
                length_m,
                static_eligible,
                raw_access_status
            FROM arcs
            WHERE arc_id = ?
            """,
            (arc_id,),
        ).fetchone()

    return dict(row) if row else None

if __name__ == "__main__":

    # 실제 DB에 존재하는 테스트 node
    test_node = 278159482

    print(f"\n현재 Node: {test_node}")
    print("이 Node에서 나갈 수 있는 Arc 목록\n")

    outgoing_arcs = get_outgoing_arcs(test_node)

    for arc in outgoing_arcs:
        print(
            f"arc_id={arc['arc_id']}, "
            f"from={arc['from_node']}, "
            f"to={arc['to_node']}, "
            f"length={arc['length_m']:.2f}m, "
            f"access={arc['raw_access_status']}"
        )

    print(f"\n총 {len(outgoing_arcs)}개의 Arc")

def get_arc_by_id(arc_id):
    """
    arc_id로 특정 Arc 정보를 조회한다.
    """

    with sqlite3.connect(ROUTING_DB) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT
                arc_id,
                edge_id,
                osm_way_id,
                from_node,
                to_node,
                length_m,
                static_eligible,
                raw_access_status
            FROM arcs
            WHERE arc_id = ?
            """,
            (arc_id,),
        ).fetchone()

    return dict(row) if row else None