# 사용자 선호 가중치
FEATURE_NAMES = [
    "COMPLEX_INTERSECTION",
    "MERGE_BRANCH",
    "NARROW_ROAD",
    "UNFAMILIAR_TURN",
    "CONSECUTIVE_ACTION",
    "CHILD_ZONE_NEARBY",
]

# 최종 라우팅 참조 구현의 raw6 ranking scale
FEATURE_SCALES = [
    10.0,      # COMPLEX_INTERSECTION
    1000.0,    # MERGE_BRANCH
    1000.0,    # NARROW_ROAD
    10.0,      # UNFAMILIAR_TURN
    10.0,      # CONSECUTIVE_ACTION
    1000.0,    # CHILD_ZONE_NEARBY
]


def calculate_survey_weights(ranks):
    """
    사용자 온보딩 순위를 6개 가중치로 변환한다.

    ranks 예:
        [2, 0, 1, 0, 0, 3]

    의미:
        COMPLEX_INTERSECTION = 2순위
        MERGE_BRANCH = 미선택
        NARROW_ROAD = 1순위
        UNFAMILIAR_TURN = 미선택
        CONSECUTIVE_ACTION = 미선택
        CHILD_ZONE_NEARBY = 3순위

    미선택 = 0
    선택한 항목은 1위부터 연속된 순위를 가져야 한다.
    """

    if len(ranks) != 6:
        raise ValueError("ranks는 반드시 6개여야 합니다.")

    if any(
        not isinstance(rank, int) or rank < 0
        for rank in ranks
    ):
        raise ValueError(
            "각 rank는 0 이상의 정수여야 합니다."
        )

    selected_ranks = sorted(
        rank for rank in ranks
        if rank > 0
    )

    k = len(selected_ranks)

    if k == 0:
        return [0.0] * 6

    if selected_ranks != list(range(1, k + 1)):
        raise ValueError(
            "선택된 순위는 1부터 연속되어야 하며 "
            "중복될 수 없습니다."
        )

    denominator = k * (k + 1) / 2

    weights = []

    for rank in ranks:

        if rank == 0:
            weights.append(0.0)

        else:
            raw_weight = k - rank + 1
            final_weight = (
                raw_weight / denominator
            )

            weights.append(final_weight)

    return weights


def calculate_personalized_burden(
    raw_features,
    weights,
):
    """
    6개 raw Feature와 사용자 가중치를 이용해
    개인화 운전부담 점수를 계산한다.

    burden =
        Σ(
            weight_i
            × raw_feature_i
            / scale_i
        )
    """

    if len(raw_features) != 6:
        raise ValueError(
            "raw_features는 반드시 6개여야 합니다."
        )

    if len(weights) != 6:
        raise ValueError(
            "weights는 반드시 6개여야 합니다."
        )

    contributions = []
    total_burden = 0.0

    for (
        feature_name,
        raw_value,
        weight,
        scale,
    ) in zip(
        FEATURE_NAMES,
        raw_features,
        weights,
        FEATURE_SCALES,
    ):

        if raw_value is None:
            raise ValueError(
                f"{feature_name} 값이 None입니다."
            )

        normalized_value = (
            raw_value / scale
        )

        weighted_value = (
            normalized_value * weight
        )

        contributions.append(
            {
                "feature": feature_name,
                "raw_value": raw_value,
                "scale": scale,
                "normalized_value": normalized_value,
                "weight": weight,
                "weighted_value": weighted_value,
            }
        )

        total_burden += weighted_value

    return {
        "weights": weights,
        "raw_features": raw_features,
        "contributions": contributions,
        "personalized_burden_score": (
            total_burden
        ),
    }


if __name__ == "__main__":

    # 예시 사용자 순위
    ranks = [
        2,  # COMPLEX_INTERSECTION
        0,  # MERGE_BRANCH
        1,  # NARROW_ROAD
        0,  # UNFAMILIAR_TURN
        0,  # CONSECUTIVE_ACTION
        3,  # CHILD_ZONE_NEARBY
    ]

    weights = calculate_survey_weights(
        ranks
    )

    # 예시 경로의 raw6
    raw_features = [
        2,      # COMPLEX_INTERSECTION
        340.0,  # MERGE_BRANCH
        180.0,  # NARROW_ROAD
        1,      # UNFAMILIAR_TURN
        4,      # CONSECUTIVE_ACTION
        250.0,  # CHILD_ZONE_NEARBY
    ]

    result = calculate_personalized_burden(
        raw_features,
        weights,
    )

    print(
        "\n=== 사용자 온보딩 가중치 ==="
    )

    for name, rank, weight in zip(
        FEATURE_NAMES,
        ranks,
        weights,
    ):
        print(
            f"{name}: "
            f"rank={rank}, "
            f"weight={weight:.4f}"
        )

    print(
        "\n=== 개인화 Feature 기여량 ==="
    )

    for item in result["contributions"]:
        print(
            f"{item['feature']}: "
            f"raw={item['raw_value']}, "
            f"scale={item['scale']}, "
            f"normalized="
            f"{item['normalized_value']:.4f}, "
            f"weight="
            f"{item['weight']:.4f}, "
            f"contribution="
            f"{item['weighted_value']:.4f}"
        )

    print(
        "\n개인화 부담점수: "
        f"{result['personalized_burden_score']:.4f}"
    )