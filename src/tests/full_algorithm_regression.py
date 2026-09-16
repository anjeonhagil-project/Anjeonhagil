from pathlib import Path
import json
import math

from src.routing.routing_data import (
    get_outgoing_arcs,
    get_arc_by_id,
)

from src.routing.transition_data import (
    get_transition_candidates,
    get_transition_info,
)

from src.routing.transition_features import (
    extract_transition_features,
)

from src.routing.merge_branch_feature import (
    calculate_merge_branch_feature,
)

from src.routing.narrow_road_feature import (
    calculate_narrow_road_feature,
)

from src.routing.child_zone_feature import (
    calculate_child_zone_feature,
)

from src.routing.consecutive_action_feature import (
    calculate_consecutive_action_feature,
)

from src.routing.personalized_burden import (
    calculate_survey_weights,
    calculate_personalized_burden,
)


BASE_DIR = Path(__file__).resolve().parents[2]

ROUTE_REQUEST = (
    BASE_DIR
    / "tools"
    / "examples"
    / "route_request.json"
)


PASS_COUNT = 0
FAIL_COUNT = 0


def check(name, condition, detail=""):
    global PASS_COUNT
    global FAIL_COUNT

    if condition:
        PASS_COUNT += 1
        print(f"[PASS] {name}")

    else:
        FAIL_COUNT += 1

        print(f"[FAIL] {name}")

        if detail:
            print(f"       {detail}")


def close(a, b, tolerance=1e-6):
    return math.isclose(
        a,
        b,
        rel_tol=1e-9,
        abs_tol=tolerance,
    )


def calculate_route_raw6(segments):
    """
    우리가 만든 각 Feature 계산기를 이용해서
    하나의 완성 경로에 대한 raw6를 계산한다.
    """

    complex_intersection = 0
    merge_branch = 0.0
    narrow_road = 0.0
    unfamiliar_turn = 0
    child_zone_nearby = 0.0

    previous_arc_id = None

    for segment in segments:
        arc_id = segment["arc_id"]

        start_fraction = segment.get(
            "start_fraction",
            0.0,
        )

        end_fraction = segment.get(
            "end_fraction",
            1.0,
        )

        arc = get_arc_by_id(arc_id)

        if arc is None:
            raise ValueError(
                f"알 수 없는 Arc: {arc_id}"
            )

        traversed_length_m = (
            arc["length_m"]
            * (end_fraction - start_fraction)
        )

        # ② MERGE_BRANCH
        merge = calculate_merge_branch_feature(
            arc_id,
            traversed_length_m=(
                traversed_length_m
            ),
        )

        if (
            merge is None
            or merge["merge_branch_score_m"] is None
        ):
            raise ValueError(
                f"MERGE_BRANCH 계산 불가: {arc_id}"
            )

        merge_branch += (
            merge["merge_branch_score_m"]
        )

        # ③ NARROW_ROAD
        narrow = calculate_narrow_road_feature(
            arc_id,
            traversed_length_m=(
                traversed_length_m
            ),
        )

        if (
            narrow is None
            or narrow["narrow_road_score_m"] is None
        ):
            raise ValueError(
                f"NARROW_ROAD 계산 불가: {arc_id}"
            )

        narrow_road += (
            narrow["narrow_road_score_m"]
        )

        # ⑥ CHILD_ZONE_NEARBY
        child = calculate_child_zone_feature(
            arc_id,
            start_fraction=start_fraction,
            end_fraction=end_fraction,
        )

        if child is None:
            raise ValueError(
                f"CHILD 계산 불가: {arc_id}"
            )

        child_zone_nearby += (
            child["child_zone_nearby_m"]
        )

        # ① COMPLEX_INTERSECTION
        # ④ UNFAMILIAR_TURN
        if previous_arc_id is not None:

            transition = get_transition_info(
                previous_arc_id,
                arc_id,
            )

            if transition is None:
                raise ValueError(
                    f"Transition 없음: "
                    f"{previous_arc_id} -> {arc_id}"
                )

            features = (
                extract_transition_features(
                    transition
                )
            )

            complex_intersection += (
                features[
                    "complex_intersection"
                ]
            )

            unfamiliar_turn += (
                features[
                    "unfamiliar_turn"
                ]
            )

        previous_arc_id = arc_id

    # ⑤ CONSECUTIVE_ACTION
    consecutive = (
        calculate_consecutive_action_feature(
            segments
        )
    )

    consecutive_action = (
        consecutive[
            "consecutive_action_count"
        ]
    )

    return [
        complex_intersection,
        merge_branch,
        narrow_road,
        unfamiliar_turn,
        consecutive_action,
        child_zone_nearby,
    ]


def main():

    print(
        "\n"
        "========================================"
    )
    print(
        " 안전하길 전체 알고리즘 회귀 테스트"
    )
    print(
        "========================================\n"
    )

    # ----------------------------------
    # 도로 그래프
    # ----------------------------------

    arcs = get_outgoing_arcs(
        278159482
    )

    arc_ids = {
        arc["arc_id"]
        for arc in arcs
    }

    check(
        "routing.sqlite Arc 조회",
        arc_ids == {
            2,
            41407,
            41408,
        },
        f"실제={arc_ids}",
    )

    # ----------------------------------
    # Transition
    # ----------------------------------

    transitions = (
        get_transition_candidates(2)
    )

    transition_targets = {
        transition["to_arc"]
        for transition in transitions
    }

    check(
        "Transition 후보 조회",
        transition_targets == {
            4,
            44894,
        },
        f"실제={transition_targets}",
    )

    # ----------------------------------
    # ① / ④
    # ----------------------------------

    transition = get_transition_info(
        3,
        41407,
    )

    features = (
        extract_transition_features(
            transition
        )
    )

    check(
        "UNFAMILIAR_TURN 검출",
        (
            features["complex_intersection"]
            == 0
            and
            features["unfamiliar_turn"]
            == 1
        ),
        f"실제={features}",
    )

    transition = get_transition_info(
        195,
        7378,
    )

    features = (
        extract_transition_features(
            transition
        )
    )

    check(
        "COMPLEX_INTERSECTION 검출",
        (
            features["complex_intersection"]
            == 1
            and
            features["unfamiliar_turn"]
            == 0
        ),
        f"실제={features}",
    )

    # ----------------------------------
    # ② MERGE_BRANCH
    # ----------------------------------

    merge = (
        calculate_merge_branch_feature(
            132
        )
    )

    check(
        "MERGE_BRANCH 계산",
        (
            merge is not None
            and
            close(
                merge["merge_score"],
                1.0,
            )
            and
            close(
                merge[
                    "merge_branch_score_m"
                ],
                34.5239649,
                tolerance=0.01,
            )
        ),
        f"실제={merge}",
    )

    # ----------------------------------
    # ③ NARROW_ROAD
    # ----------------------------------

    narrow = (
        calculate_narrow_road_feature(
            1866
        )
    )

    check(
        "NARROW_ROAD 계산",
        (
            narrow is not None
            and
            close(
                narrow["narrow_score"],
                1.0,
            )
            and
            close(
                narrow[
                    "narrow_road_score_m"
                ],
                5.8470922,
                tolerance=0.01,
            )
        ),
        f"실제={narrow}",
    )

    # ----------------------------------
    # ⑥ CHILD + 역방향
    # ----------------------------------

    child = calculate_child_zone_feature(
        261,
        start_fraction=0.0,
        end_fraction=0.1,
    )

    check(
        "CHILD_ZONE_NEARBY 역방향",
        (
            child is not None
            and
            close(
                child[
                    "edge_start_fraction"
                ],
                0.9,
            )
            and
            close(
                child[
                    "edge_end_fraction"
                ],
                1.0,
            )
            and
            close(
                child[
                    "child_zone_nearby_m"
                ],
                1.123421798,
                tolerance=0.001,
            )
        ),
        f"실제={child}",
    )

    # ----------------------------------
    # 공식 예제 경로 전체 raw6
    # ----------------------------------

    with open(
        ROUTE_REQUEST,
        "r",
        encoding="utf-8",
    ) as file:
        route_request = json.load(file)

    segments = route_request["segments"]

    raw6 = calculate_route_raw6(
        segments
    )

    # 최종 CHILD100 기준
    expected_raw6 = [
        0,
        220.20604911059073,
        433.40092307851114,
        0,
        4,
        188.8747638292946,
    ]

    raw6_ok = all(
        close(
            actual,
            expected,
            tolerance=0.001,
        )
        for actual, expected
        in zip(
            raw6,
            expected_raw6,
        )
    )

    check(
        "경로 전체 6개 Feature 집계",
        raw6_ok,
        (
            f"\n"
            f"       실제   = {raw6}\n"
            f"       기대값 = {expected_raw6}"
        ),
    )

    # ----------------------------------
    # 사용자 가중치
    # ----------------------------------

    ranks = [
        2,
        0,
        1,
        0,
        0,
        3,
    ]

    weights = (
        calculate_survey_weights(
            ranks
        )
    )

    expected_weights = [
        1 / 3,
        0.0,
        1 / 2,
        0.0,
        0.0,
        1 / 6,
    ]

    weights_ok = all(
        close(a, b)
        for a, b
        in zip(
            weights,
            expected_weights,
        )
    )

    check(
        "온보딩 순위 → 사용자 가중치",
        weights_ok,
        f"실제={weights}",
    )

    # ----------------------------------
    # 개인화 부담점수
    # ----------------------------------

    sample_raw6 = [
        2,
        340.0,
        180.0,
        1,
        4,
        250.0,
    ]

    personalized = (
        calculate_personalized_burden(
            sample_raw6,
            weights,
        )
    )

    score = personalized[
        "personalized_burden_score"
    ]

    check(
        "개인화 부담점수",
        close(
            score,
            0.19833333333333333,
            tolerance=0.0001,
        ),
        f"실제={score}",
    )

    # ----------------------------------
    # 결과
    # ----------------------------------

    print(
        "\n"
        "========================================"
    )

    print(
        f"PASS: {PASS_COUNT}"
    )

    print(
        f"FAIL: {FAIL_COUNT}"
    )

    if FAIL_COUNT == 0:
        print(
            "\n✅ 전체 알고리즘 회귀 테스트 통과"
        )
        print(
            "Supabase 전환 전 계산 로직 상태 정상"
        )

    else:
        print(
            "\n❌ 실패한 항목이 있습니다."
        )
        raise SystemExit(1)

    print(
        "========================================"
    )


if __name__ == "__main__":
    main()