from pathlib import Path
import sqlite3


BASE_DIR = Path(__file__).resolve().parents[2]

TRANSITIONS_DB = (
    BASE_DIR
    / "data"
    / "transitions.sqlite"
)


def get_transition_candidates(from_arc):
    """
    특정 Arc를 타고 왔을 때
    다음으로 연결되는 transition 정보를 반환한다.
    """

    with sqlite3.connect(TRANSITIONS_DB) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            """
            SELECT
                from_arc,
                to_arc,
                via_node,
                abs_turn_angle_deg,
                node_degree,
                complex_proxy,
                unfamiliar_proxy
            FROM transition_proxy
            WHERE from_arc = ?
            ORDER BY to_arc
            """,
            (from_arc,),
        ).fetchall()

    return [dict(row) for row in rows]

def get_transition_info(from_arc, to_arc):
    """
    특정 from_arc -> to_arc 전이 정보를 1건 반환한다.
    없으면 None 반환.
    """

    with sqlite3.connect(TRANSITIONS_DB) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT
                from_arc,
                to_arc,
                via_node,
                abs_turn_angle_deg,
                node_degree,
                complex_proxy,
                unfamiliar_proxy
            FROM transition_proxy
            WHERE from_arc = ?
              AND to_arc = ?
            """,
            (from_arc, to_arc),
        ).fetchone()

    return dict(row) if row else None


# if __name__ == "__main__":
#     previous_arc = 2
#     print(
#         f"\n=== Arc {previous_arc} 이후 가능한 Transition ==="
#     )
#     transitions = get_transition_candidates(
#         previous_arc
#     )
#     for transition in transitions:
#         print(
#             f"\n"
#             f"from_arc: {transition['from_arc']}\n"
#             f"to_arc: {transition['to_arc']}\n"
#             f"via_node: {transition['via_node']}\n"
#             f"회전각: "
#             f"{transition['abs_turn_angle_deg']:.2f}도\n"
#             f"node_degree: "
#             f"{transition['node_degree']}\n"
#             f"complex_proxy: "
#             f"{transition['complex_proxy']}\n"
#             f"unfamiliar_proxy: "
#             f"{transition['unfamiliar_proxy']}"
#         )

#     print(
#         f"\n총 {len(transitions)}개의 Transition"
#     )


if __name__ == "__main__":
    previous_arc = 2

    print(
        f"\n=== Arc {previous_arc} 이후 가능한 Transition ==="
    )

    transitions = get_transition_candidates(
        previous_arc
    )

    for transition in transitions:
        print(
            f"\n"
            f"from_arc: {transition['from_arc']}\n"
            f"to_arc: {transition['to_arc']}\n"
            f"via_node: {transition['via_node']}\n"
            f"회전각: "
            f"{transition['abs_turn_angle_deg']:.2f}도\n"
            f"node_degree: "
            f"{transition['node_degree']}\n"
            f"complex_proxy: "
            f"{transition['complex_proxy']}\n"
            f"unfamiliar_proxy: "
            f"{transition['unfamiliar_proxy']}"
        )

    print(
        f"\n총 {len(transitions)}개의 Transition"
    )