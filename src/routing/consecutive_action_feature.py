from pathlib import Path
import sqlite3
import json

from src.routing.routing_data import get_arc_by_id
from src.routing.transition_data import get_transition_info


BASE_DIR = Path(__file__).resolve().parents[2]

GRAPH_DB = (
    BASE_DIR
    / "data"
    / "support"
    / "graph.sqlite"
)

EXAMPLE_ROUTE = (
    BASE_DIR
    / "tools"
    / "examples"
    / "route_request.json"
)

ACTION_ANGLE_MIN_DEG = 45.0
CONSECUTIVE_MAX_DISTANCE_M = 100.0


def get_arc_highway(arc_id):
    """
    Arc의 highway 종류를 조회한다.
    예: residential, primary, primary_link
    """

    with sqlite3.connect(GRAPH_DB) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT
                highway
            FROM arcs
            WHERE arc_id = ?
            """,
            (arc_id,),
        ).fetchone()

    return row["highway"] if row else None


def is_action_candidate(
    previous_arc,
    next_arc,
    transition,
    previous_highway,
    next_highway,
):
    """
    최종 개발 규칙에 따라
    해당 Transition이 조작 후보인지 판정한다.
    """

    if transition is None:
        return False

    # 실제 조작 후보로 볼 수 있는 교차/도로 변경 상황인지
    eligible = (
        transition["node_degree"] >= 3
        or previous_arc["osm_way_id"]
        != next_arc["osm_way_id"]
    )

    if not eligible:
        return False

    angle_action = (
        transition["abs_turn_angle_deg"]
        >= ACTION_ANGLE_MIN_DEG
    )

    previous_link = (
        previous_highway is not None
        and previous_highway.endswith("_link")
    )

    next_link = (
        next_highway is not None
        and next_highway.endswith("_link")
    )

    return (
        angle_action
        or previous_link
        or next_link
    )


def calculate_consecutive_action_feature(segments):
    """
    ordered route segments를 받아
    CONSECUTIVE_ACTION 횟수를 계산한다.

    segments 예:
    [
        {"arc_id": 100},
        {"arc_id": 200},
        ...
    ]
    """

    if not segments:
        raise ValueError("경로가 비어 있습니다.")

    total_distance_m = 0.0
    actions = []

    previous_arc = None
    previous_highway = None

    for index, segment in enumerate(segments):

        arc_id = segment["arc_id"]

        start_fraction = segment.get(
            "start_fraction",
            0.0,
        )

        end_fraction = segment.get(
            "end_fraction",
            1.0,
        )

        if not (
            0.0
            <= start_fraction
            < end_fraction
            <= 1.0
        ):
            raise ValueError(
                f"잘못된 fraction: arc_id={arc_id}"
            )

        # 부분 Arc는 첫 번째/마지막 Arc에만 허용
        if index > 0 and start_fraction != 0.0:
            raise ValueError(
                "start_fraction 부분 통과는 "
                "첫 번째 Arc에서만 허용합니다."
            )

        if (
            index < len(segments) - 1
            and end_fraction != 1.0
        ):
            raise ValueError(
                "end_fraction 부분 통과는 "
                "마지막 Arc에서만 허용합니다."
            )

        arc = get_arc_by_id(arc_id)

        if arc is None:
            raise ValueError(
                f"존재하지 않는 Arc: {arc_id}"
            )

        highway = get_arc_highway(arc_id)

        if highway is None:
            raise ValueError(
                f"highway 정보 없음: arc_id={arc_id}"
            )

        if previous_arc is not None:

            if (
                previous_arc["to_node"]
                != arc["from_node"]
            ):
                raise ValueError(
                    f"연결되지 않은 Arc: "
                    f"{previous_arc['arc_id']} "
                    f"-> {arc_id}"
                )

            transition = get_transition_info(
                previous_arc["arc_id"],
                arc_id,
            )

            if transition is None:
                raise ValueError(
                    f"Transition 없음: "
                    f"{previous_arc['arc_id']} "
                    f"-> {arc_id}"
                )

            if is_action_candidate(
                previous_arc,
                arc,
                transition,
                previous_highway,
                highway,
            ):
                actions.append(
                    {
                        "previous_arc": (
                            previous_arc["arc_id"]
                        ),
                        "next_arc": arc_id,
                        "position_m": (
                            total_distance_m
                        ),
                        "angle_deg": (
                            transition[
                                "abs_turn_angle_deg"
                            ]
                        ),
                        "node_degree": (
                            transition[
                                "node_degree"
                            ]
                        ),
                        "previous_highway": (
                            previous_highway
                        ),
                        "next_highway": highway,
                    }
                )

        traversed_length_m = (
            arc["length_m"]
            * (
                end_fraction
                - start_fraction
            )
        )

        total_distance_m += traversed_length_m

        previous_arc = arc
        previous_highway = highway

    consecutive_pairs = []

    for first_action, second_action in zip(
        actions,
        actions[1:],
    ):
        distance_between_m = (
            second_action["position_m"]
            - first_action["position_m"]
        )

        if (
            0.0
            < distance_between_m
            <= CONSECUTIVE_MAX_DISTANCE_M
        ):
            consecutive_pairs.append(
                {
                    "first": (
                        first_action[
                            "previous_arc"
                        ],
                        first_action["next_arc"],
                    ),
                    "second": (
                        second_action[
                            "previous_arc"
                        ],
                        second_action["next_arc"],
                    ),
                    "distance_m": (
                        distance_between_m
                    ),
                }
            )

    return {
        "action_count": len(actions),
        "actions": actions,
        "consecutive_action_count": (
            len(consecutive_pairs)
        ),
        "consecutive_pairs": (
            consecutive_pairs
        ),
        "route_distance_m": (
            total_distance_m
        ),
    }


if __name__ == "__main__":

    with open(
        EXAMPLE_ROUTE,
        "r",
        encoding="utf-8",
    ) as file:
        request = json.load(file)

    result = (
        calculate_consecutive_action_feature(
            request["segments"]
        )
    )

    print(
        "\n=== CONSECUTIVE_ACTION Feature ==="
    )

    print(
        f"전체 조작 후보 수: "
        f"{result['action_count']}"
    )

    print(
        f"CONSECUTIVE_ACTION: "
        f"{result['consecutive_action_count']}"
    )

    print("\n=== 연속 조작 쌍 ===")

    for pair in result[
        "consecutive_pairs"
    ]:
        print(
            f"{pair['first']} -> "
            f"{pair['second']}, "
            f"거리={pair['distance_m']:.2f}m"
        )