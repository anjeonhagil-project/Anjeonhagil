"""Q2+Q4 XGBoost 최종 재학습 + Test 평가.

프로젝트 루트에서 실행:
    python -B ml/validation/xgboost_q2_q4/07_final_test.py

절차:
1. 6단계에서 확정된 하이퍼파라미터를 불러온다.
2. Train 70% + Validation 15% = 85%를 합친다.
3. Train+Validation 85%만으로 scale을 다시 계산한다.
4. 확정 파라미터로 XGBoost 최종 모델을 새로 학습한다.
5. 처음으로 Test 15%를 평가한다.
6. Accuracy, ROC-AUC, Log Loss, Search Top-1을 저장한다.

주의:
- Test 데이터는 학습/스케일링/파라미터 선택에 사용하지 않는다.
- Test 결과를 본 뒤 하이퍼파라미터를 다시 변경하지 않는다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
from pathlib import Path

import numpy as np
import pandas as pd


# ------------------------------------------------------------
# 경로
# ------------------------------------------------------------

FILE = Path(__file__).resolve()
ROOT = FILE.parents[3]
SRC = ROOT / "ml" / "src"

if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from features import FEATURES as PROJECT_FEATURES


FEATURES = list(PROJECT_FEATURES)

DEFAULT_INPUT = (
    ROOT / "ml" / "data" / "q2_q4"
    / "synthetic_pairwise_q2_q4.csv"
)

STAGE6_CONFIG = (
    ROOT / "ml" / "artifacts" / "xgboost_q2_q4"
    / "06_depth_recheck" / "selected_config.json"
)

DEFAULT_OUTPUT = (
    ROOT / "ml" / "artifacts" / "xgboost_q2_q4"
    / "07_final_test"
)

OUTPUT_FILES = [
    "final_model.json",
    "final_config.json",
    "metadata.json",
    "test_evaluation.json",
    "summary.txt",
]


# ------------------------------------------------------------
# 공통
# ------------------------------------------------------------

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_json(path: Path, value) -> None:
    path.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            allow_nan=False,
        ) + "\n",
        encoding="utf-8",
    )


def prepare_output(output: Path) -> None:
    existing = [
        output / name
        for name in OUTPUT_FILES
        if (output / name).exists()
    ]

    if existing:
        files = "\n".join(
            str(path)
            for path in existing
        )

        raise FileExistsError(
            "기존 07_final_test 결과가 있습니다.\n"
            "최종 Test는 반복해서 확인하지 않는 것이 원칙이므로 "
            "자동으로 덮어쓰지 않습니다.\n"
            f"{files}"
        )

    output.mkdir(
        parents=True,
        exist_ok=True,
    )


# ------------------------------------------------------------
# 6단계 최종 파라미터 확인
# ------------------------------------------------------------

def load_stage6_config():
    if not STAGE6_CONFIG.is_file():
        raise FileNotFoundError(
            "6단계 selected_config.json을 찾을 수 없습니다.\n"
            f"예상 경로: {STAGE6_CONFIG}"
        )

    config = json.loads(
        STAGE6_CONFIG.read_text(
            encoding="utf-8-sig"
        )
    )

    required = {
        "max_depth",
        "learning_rate",
        "n_estimators",
        "subsample",
        "colsample_bytree",
        "objective",
        "eval_metric",
        "random_state",
        "n_jobs",
        "tree_method",
        "test_evaluated",
    }

    missing = sorted(
        required - set(config)
    )

    if missing:
        raise ValueError(
            "6단계 selected_config.json에 "
            f"필수 값이 없습니다: {missing}"
        )

    if config["test_evaluated"] is not False:
        raise ValueError(
            "6단계에서 이미 Test가 평가된 것으로 기록되어 있습니다."
        )

    if config.get("boundary_selected") is True:
        raise ValueError(
            "6단계 최종 max_depth가 탐색 범위 경계값입니다. "
            "최종 Test 전에 depth 검증을 마무리하세요."
        )

    return config


# ------------------------------------------------------------
# 데이터 검증
# ------------------------------------------------------------

def load_data(input_path: Path):
    if not input_path.is_file():
        raise FileNotFoundError(
            "Q2+Q4 합성데이터를 찾을 수 없습니다.\n"
            f"{input_path}"
        )

    metadata_path = (
        input_path.parent
        / "metadata.json"
    )

    if not metadata_path.is_file():
        raise FileNotFoundError(
            "Q2+Q4 생성 metadata.json을 찾을 수 없습니다.\n"
            f"{metadata_path}"
        )

    metadata = json.loads(
        metadata_path.read_text(
            encoding="utf-8-sig"
        )
    )

    if (
        metadata.get("purpose")
        != "synthetic_q2_q4_common_model_comparison"
    ):
        raise ValueError(
            "metadata purpose가 "
            "Q2+Q4 공통 모델 비교용이 아닙니다."
        )

    if list(
        metadata.get(
            "feature_names",
            [],
        )
    ) != FEATURES:
        raise ValueError(
            "metadata Feature 순서와 "
            "현재 features.py의 FEATURES가 다릅니다."
        )

    expected_hash = (
        metadata
        .get("output_sha256", {})
        .get(
            "synthetic_pairwise_q2_q4.csv"
        )
    )

    if not expected_hash:
        raise ValueError(
            "metadata에 Q2+Q4 CSV SHA256이 없습니다."
        )

    actual_hash = sha256(
        input_path
    )

    if actual_hash != expected_hash:
        raise ValueError(
            "Q2+Q4 CSV SHA256이 "
            "생성 metadata와 다릅니다."
        )

    df = pd.read_csv(
        input_path
    )

    required = {
        "search_id",
        "split",
        "a",
        "b",
        "y",
        "sample_weight",
        "m_time",
        "m_distance",
        *FEATURES,
    }

    missing = sorted(
        required - set(df.columns)
    )

    if missing:
        raise ValueError(
            f"필수 컬럼이 없습니다: {missing}"
        )

    if df.empty:
        raise ValueError(
            "입력 CSV가 비어 있습니다."
        )

    x = df[
        FEATURES
    ].to_numpy(
        dtype=float
    )

    if not np.isfinite(x).all():
        raise ValueError(
            "X8 Feature에 NaN 또는 inf가 있습니다."
        )

    allowed_splits = {
        "train",
        "validation",
        "test",
    }

    if not set(
        df["split"].unique()
    ).issubset(
        allowed_splits
    ):
        raise ValueError(
            "split은 train / validation / test만 허용합니다."
        )

    for split in [
        "train",
        "validation",
        "test",
    ]:
        if not (
            df["split"] == split
        ).any():
            raise ValueError(
                f"{split} 데이터가 없습니다."
            )

    if not set(
        df["y"].unique()
    ).issubset(
        {0, 1}
    ):
        raise ValueError(
            "y는 0 또는 1이어야 합니다."
        )

    if (
        df["a"]
        == df["b"]
    ).any():
        raise ValueError(
            "A와 B 후보가 같은 row가 존재합니다."
        )

    split_per_search = (
        df.groupby(
            "search_id"
        )["split"]
        .nunique()
    )

    if (
        split_per_search != 1
    ).any():
        raise ValueError(
            "같은 search_id가 여러 split에 섞여 있습니다."
        )

    pair_counts = (
        df.groupby(
            "search_id"
        ).size()
    )

    if not (
        pair_counts == 2
    ).all():
        raise ValueError(
            "각 search_id에는 정확히 2개의 pair가 있어야 합니다."
        )

    weight_sum = (
        df.groupby(
            "search_id"
        )["sample_weight"]
        .sum()
        .to_numpy(
            dtype=float
        )
    )

    if not np.allclose(
        weight_sum,
        1.0,
        rtol=0.0,
        atol=1e-12,
    ):
        raise ValueError(
            "검색별 sample_weight 합이 1이 아닙니다."
        )

    for column in [
        "m_time",
        "m_distance",
    ]:
        values = df[
            column
        ].to_numpy(
            dtype=float
        )

        if not np.isfinite(
            values
        ).all():
            raise ValueError(
                f"{column}에 NaN 또는 inf가 있습니다."
            )

        if (
            (values < 0.5)
            | (values > 2.0)
        ).any():
            raise ValueError(
                f"{column}은 [0.5, 2.0] 범위여야 합니다."
            )

        if (
            df.groupby(
                "search_id"
            )[column]
            .nunique()
            != 1
        ).any():
            raise ValueError(
                f"같은 search_id 안에서 "
                f"{column} 값이 다릅니다."
            )

    search_counts = (
        df[
            ["search_id", "split"]
        ]
        .drop_duplicates()
        ["split"]
        .value_counts()
        .to_dict()
    )

    total = int(
        df[
            "search_id"
        ].nunique()
    )

    train_count = (
        total * 70 // 100
    )

    validation_count = (
        total * 15 // 100
    )

    expected_counts = {
        "train":
            train_count,

        "validation":
            validation_count,

        "test":
            total
            - train_count
            - validation_count,
    }

    if (
        search_counts
        != expected_counts
    ):
        raise ValueError(
            "search_id 기준 split이 70:15:15가 아닙니다.\n"
            f"실제: {search_counts}\n"
            f"예상: {expected_counts}"
        )

    return (
        df,
        metadata,
        metadata_path,
    )


# ------------------------------------------------------------
# 대칭 확률
# ------------------------------------------------------------

def probability(
    model,
    x,
):
    x = np.atleast_2d(
        np.asarray(
            x,
            dtype=float,
        )
    )

    p_forward = (
        model.predict_proba(
            x
        )[:, 1]
    )

    p_reverse = (
        model.predict_proba(
            -x
        )[:, 1]
    )

    return (
        p_forward
        + 1.0
        - p_reverse
    ) / 2.0


# ------------------------------------------------------------
# Search Top-1
# ------------------------------------------------------------

def row_x(row):
    return np.asarray(
        [
            getattr(
                row,
                feature,
            )
            for feature
            in FEATURES
        ],
        dtype=float,
    )


def infer_chosen_candidate(
    group,
):
    chosen = [
        int(
            row.a
            if row.y == 1
            else row.b
        )
        for row
        in group.itertuples(
            index=False
        )
    ]

    if len(
        set(chosen)
    ) != 1:
        raise ValueError(
            f"search_id="
            f"{group.iloc[0]['search_id']}의 pair들이 "
            "서로 다른 선택 후보를 가리킵니다."
        )

    return chosen[0]


def reconstruct_all_pair_differences(
    group,
):
    rows = list(
        group.itertuples(
            index=False
        )
    )

    if len(rows) != 2:
        raise ValueError(
            "검색당 정확히 2개의 pair가 필요합니다."
        )

    values = {
        int(
            rows[0].a
        ):
        np.zeros(
            len(FEATURES),
            dtype=float,
        )
    }

    changed = True

    while changed:
        changed = False

        for row in rows:
            a = int(
                row.a
            )

            b = int(
                row.b
            )

            x = row_x(
                row
            )

            if (
                a in values
                and b not in values
            ):
                values[b] = (
                    values[a]
                    - x
                )

                changed = True

            elif (
                b in values
                and a not in values
            ):
                values[a] = (
                    values[b]
                    + x
                )

                changed = True

    if set(
        values
    ) != {
        0,
        1,
        2,
    }:
        raise ValueError(
            "두 pair로 후보 0/1/2의 "
            "전체 pair 관계를 복원할 수 없습니다."
        )

    return np.vstack([
        values[0]
        - values[1],

        values[0]
        - values[2],

        values[1]
        - values[2],
    ])


def search_top1(
    model,
    frame,
    scale,
):
    hits = 0
    total = 0

    for _, group in frame.groupby(
        "search_id",
        sort=False,
    ):
        pair_x = (
            reconstruct_all_pair_differences(
                group
            )
            / scale
        )

        pair_probability = (
            probability(
                model,
                pair_x,
            )
        )

        p01, p02, p12 = (
            pair_probability
        )

        scores = np.array([
            p01 + p02,

            (
                1.0
                - p01
            )
            + p12,

            (
                1.0
                - p02
            )
            + (
                1.0
                - p12
            ),
        ])

        predicted = int(
            np.argmax(
                scores
            )
        )

        chosen = (
            infer_chosen_candidate(
                group
            )
        )

        hits += int(
            predicted == chosen
        )

        total += 1

    return {
        "top1":
            hits / total,

        "top1_hits":
            hits,

        "top1_searches":
            total,
    }


# ------------------------------------------------------------
# Test 평가
# ------------------------------------------------------------

def evaluate_test(
    model,
    test,
    scale,
):
    from sklearn.metrics import (
        accuracy_score,
        log_loss,
        roc_auc_score,
    )

    x = (
        test[
            FEATURES
        ]
        .to_numpy(
            dtype=float
        )
        / scale
    )

    y = (
        test["y"]
        .to_numpy(
            dtype=int
        )
    )

    p = probability(
        model,
        x,
    )

    prediction = (
        p >= 0.5
    ).astype(
        int
    )

    raw = (
        model.predict_proba(
            x
        )[:, 1]
    )

    reverse_raw = (
        model.predict_proba(
            -x
        )[:, 1]
    )

    direction_error = float(
        np.max(
            np.abs(
                p
                + probability(
                    model,
                    -x,
                )
                - 1.0
            )
        )
    )

    if direction_error > 1e-6:
        raise RuntimeError(
            "대칭화 확률 방향 검사에 실패했습니다."
        )

    top1 = search_top1(
        model,
        test,
        scale,
    )

    return {
        "rows":
            int(
                len(test)
            ),

        "searches":
            int(
                test[
                    "search_id"
                ].nunique()
            ),

        "accuracy":
            float(
                accuracy_score(
                    y,
                    prediction,
                )
            ),

        "roc_auc":
            float(
                roc_auc_score(
                    y,
                    p,
                )
            ),

        "log_loss":
            float(
                log_loss(
                    y,
                    p,
                    labels=[
                        0,
                        1,
                    ],
                )
            ),

        "top1":
            float(
                top1[
                    "top1"
                ]
            ),

        "top1_hits":
            int(
                top1[
                    "top1_hits"
                ]
            ),

        "top1_searches":
            int(
                top1[
                    "top1_searches"
                ]
            ),

        "raw_direction_error_mean":
            float(
                np.mean(
                    np.abs(
                        raw
                        + reverse_raw
                        - 1.0
                    )
                )
            ),

        "symmetrized_direction_error_max":
            direction_error,
    }


# ------------------------------------------------------------
# 실행
# ------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description=(
            "Q2+Q4 XGBoost "
            "Train+Validation 85% 최종 재학습 "
            "+ Test 15% 평가"
        )
    )

    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
    )

    args = parser.parse_args()

    input_path = (
        args.input
        .expanduser()
        .resolve()
    )

    output = (
        args.output
        .expanduser()
        .resolve()
    )

    stage6_config = (
        load_stage6_config()
    )

    (
        df,
        source_metadata,
        source_metadata_path,
    ) = load_data(
        input_path
    )

    train_validation = (
        df[
            df["split"].isin(
                [
                    "train",
                    "validation",
                ]
            )
        ]
        .copy()
        .reset_index(
            drop=True
        )
    )

    test = (
        df[
            df["split"]
            == "test"
        ]
        .copy()
        .reset_index(
            drop=True
        )
    )

    prepare_output(
        output
    )

    # --------------------------------------------------------
    # Train + Validation 85%로 scale 재계산
    # --------------------------------------------------------

    train_validation_x_raw = (
        train_validation[
            FEATURES
        ]
        .to_numpy(
            dtype=float
        )
    )

    scale = np.std(
        train_validation_x_raw,
        axis=0,
    )

    scale[
        scale < 1e-12
    ] = 1.0

    if not np.isfinite(
        scale
    ).all():
        raise ValueError(
            "Train+Validation에서 계산한 "
            "scale에 NaN 또는 inf가 있습니다."
        )

    train_validation_x = (
        train_validation_x_raw
        / scale
    )

    train_validation_y = (
        train_validation[
            "y"
        ]
        .to_numpy(
            dtype=int
        )
    )

    train_validation_weight = (
        train_validation[
            "sample_weight"
        ]
        .to_numpy(
            dtype=float
        )
    )

    if np.unique(
        train_validation_y
    ).size != 2:
        raise ValueError(
            "Train+Validation y에는 "
            "0과 1이 모두 있어야 합니다."
        )

    if np.unique(
        test["y"].to_numpy(
            dtype=int
        )
    ).size != 2:
        raise ValueError(
            "Test y에는 0과 1이 모두 있어야 합니다."
        )

    try:
        import sklearn
        import xgboost
        from xgboost import XGBClassifier

    except ImportError as error:
        raise SystemExit(
            "학습 패키지가 없습니다.\n"
            "python -m pip install -r ml/requirements.txt "
            "를 먼저 실행하세요."
        ) from error

    # --------------------------------------------------------
    # 6단계에서 확정된 파라미터 그대로 사용
    # --------------------------------------------------------

    params = {
        "max_depth":
            int(
                stage6_config[
                    "max_depth"
                ]
            ),

        "learning_rate":
            float(
                stage6_config[
                    "learning_rate"
                ]
            ),

        "n_estimators":
            int(
                stage6_config[
                    "n_estimators"
                ]
            ),

        "subsample":
            float(
                stage6_config[
                    "subsample"
                ]
            ),

        "colsample_bytree":
            float(
                stage6_config[
                    "colsample_bytree"
                ]
            ),

        "objective":
            stage6_config[
                "objective"
            ],

        "eval_metric":
            stage6_config[
                "eval_metric"
            ],

        "random_state":
            int(
                stage6_config[
                    "random_state"
                ]
            ),

        "n_jobs":
            int(
                stage6_config[
                    "n_jobs"
                ]
            ),

        "tree_method":
            stage6_config[
                "tree_method"
            ],
    }

    print(
        "[XGBoost Q2+Q4 최종 Test 평가]"
    )

    print(
        "입력:",
        input_path,
    )

    print(
        "Train+Validation:",
        train_validation[
            "search_id"
        ].nunique(),
        "searches /",
        len(
            train_validation
        ),
        "rows",
    )

    print(
        "Test:",
        test[
            "search_id"
        ].nunique(),
        "searches /",
        len(test),
        "rows",
    )

    print(
        "최종 파라미터:"
    )

    for key, value in params.items():
        print(
            f"- {key} = {value}"
        )

    print(
        "\nTrain+Validation 85%로 "
        "최종 모델 재학습 중...",
        flush=True,
    )

    final_model = XGBClassifier(
        **params
    )

    final_model.fit(
        train_validation_x,
        train_validation_y,
        sample_weight=(
            train_validation_weight
        ),
    )

    print(
        "최종 학습 완료"
    )

    print(
        "\nTest 15% 최종 평가 중...",
        flush=True,
    )

    test_metrics = (
        evaluate_test(
            final_model,
            test,
            scale,
        )
    )

    # --------------------------------------------------------
    # 모델 저장 및 reload 검증
    # --------------------------------------------------------

    final_model_path = (
        output
        / "final_model.json"
    )

    final_model.save_model(
        str(
            final_model_path
        )
    )

    restored = XGBClassifier()

    restored.load_model(
        str(
            final_model_path
        )
    )

    test_x = (
        test[
            FEATURES
        ]
        .to_numpy(
            dtype=float
        )
        / scale
    )

    original_probability = (
        probability(
            final_model,
            test_x,
        )
    )

    restored_probability = (
        probability(
            restored,
            test_x,
        )
    )

    if not np.allclose(
        original_probability,
        restored_probability,
    ):
        raise RuntimeError(
            "저장 전후 최종 모델의 "
            "Test 예측값이 다릅니다."
        )

    # --------------------------------------------------------
    # 결과 저장
    # --------------------------------------------------------

    report = {
        "stage":
            "final_q2_q4_test",

        "comparison_scope":
            "final_test_only",

        "input_file":
            str(
                input_path
            ),

        "input_sha256":
            sha256(
                input_path
            ),

        "source_metadata_sha256":
            sha256(
                source_metadata_path
            ),

        "stage6_config_file":
            str(
                STAGE6_CONFIG
            ),

        "stage6_config_sha256":
            sha256(
                STAGE6_CONFIG
            ),

        "features":
            FEATURES,

        "training_split":
            "train_plus_validation",

        "training_rows":
            int(
                len(
                    train_validation
                )
            ),

        "training_searches":
            int(
                train_validation[
                    "search_id"
                ].nunique()
            ),

        "test_rows":
            int(
                len(
                    test
                )
            ),

        "test_searches":
            int(
                test[
                    "search_id"
                ].nunique()
            ),

        "scale_basis":
            (
                "Train+Validation Q2+Q4 X only; "
                "np.std(axis=0); center=False"
            ),

        "sample_weight_policy":
            (
                "CSV sample_weight = "
                "1 / pairs_per_search"
            ),

        "probability":
            "(p(x)+1-p(-x))/2",

        "ranking":
            "probability_sum",

        "final_params":
            params,

        "test":
            test_metrics,

        "test_evaluated":
            True,

        "test_used_for_training":
            False,

        "test_used_for_scaling":
            False,

        "test_used_for_parameter_selection":
            False,

        "synthetic_note": (
            "m_time/m_distance는 실제 Q4 4문항 fit 결과가 아니라 "
            "합성 프로필이다. 실제 사용자 성능으로 해석하지 않는다."
        ),

        "versions": {
            "python":
                platform.python_version(),

            "numpy":
                np.__version__,

            "pandas":
                pd.__version__,

            "xgboost":
                xgboost.__version__,

            "sklearn":
                sklearn.__version__,
        },
    }

    save_json(
        output
        / "test_evaluation.json",
        report,
    )

    save_json(
        output
        / "final_config.json",
        {
            **params,

            "training_split":
                "train_plus_validation",

            "test_evaluated":
                True,

            "stage6_config_sha256":
                report[
                    "stage6_config_sha256"
                ],
        },
    )

    save_json(
        output
        / "metadata.json",
        {
            "features":
                FEATURES,

            "scale":
                scale.tolist(),

            "center":
                False,

            "scale_basis":
                report[
                    "scale_basis"
                ],

            "probability":
                report[
                    "probability"
                ],

            "ranking":
                report[
                    "ranking"
                ],

            "sample_weight_policy":
                report[
                    "sample_weight_policy"
                ],

            "training_source":
                source_metadata.get(
                    "training_source"
                ),

            "real_user_validated":
                source_metadata.get(
                    "real_user_validated"
                ),

            "test_evaluated":
                True,

            "versions":
                report[
                    "versions"
                ],
        },
    )

    summary_lines = [
        "[XGBoost Q2+Q4 최종 Test 평가]",
        "",
        f"입력 데이터: {input_path}",
        "",
        "최종 학습 데이터",
        (
            "- Train + Validation = "
            f"{train_validation['search_id'].nunique()} searches / "
            f"{len(train_validation)} rows"
        ),
        "",
        "최종 Test 데이터",
        (
            "- Test = "
            f"{test['search_id'].nunique()} searches / "
            f"{len(test)} rows"
        ),
        "",
        "최종 하이퍼파라미터",
        f"- max_depth = {params['max_depth']}",
        f"- learning_rate = {params['learning_rate']}",
        f"- n_estimators = {params['n_estimators']}",
        f"- subsample = {params['subsample']}",
        (
            "- colsample_bytree = "
            f"{params['colsample_bytree']}"
        ),
        "",
        "최종 Test 결과",
        (
            "- Accuracy = "
            f"{test_metrics['accuracy']:.2%}"
        ),
        (
            "- ROC-AUC = "
            f"{test_metrics['roc_auc']:.6f}"
        ),
        (
            "- Log Loss = "
            f"{test_metrics['log_loss']:.6f}"
        ),
        (
            "- Search Top-1 = "
            f"{test_metrics['top1']:.2%} "
            f"("
            f"{test_metrics['top1_hits']}/"
            f"{test_metrics['top1_searches']}"
            f")"
        ),
        "",
        "Test 사용 규칙",
        "- Test는 최종 모델 학습에 사용하지 않음",
        "- Test는 scale 계산에 사용하지 않음",
        "- Test는 하이퍼파라미터 선택에 사용하지 않음",
        "- Test 결과 확인 후 파라미터 재조정 금지",
        "",
    ]

    summary = (
        "\n".join(
            summary_lines
        )
        + "\n"
    )

    (
        output
        / "summary.txt"
    ).write_text(
        summary,
        encoding="utf-8",
    )

    print()
    print(summary)

    print(
        "결과 폴더:",
        output,
    )


if __name__ == "__main__":
    main()