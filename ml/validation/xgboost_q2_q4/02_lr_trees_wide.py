"""Q2+Q4 XGBoost 2단계: learning_rate × n_estimators 넓은 범위 검증.

프로젝트 루트에서 실행:
    python -B ml/validation/xgboost_q2_q4/02_lr_trees_wide.py

입력:
    ml/data/q2_q4/synthetic_pairwise_q2_q4.csv

1단계 결과:
    ml/artifacts/xgboost_q2_q4/01_max_depth/selected_config.json

출력:
    ml/artifacts/xgboost_q2_q4/02_lr_trees_wide/

규칙:
- 1단계에서 선택된 max_depth를 자동으로 불러와 고정
- learning_rate = 0.01, 0.02, 0.04, 0.06, 0.10, 0.15, 0.20
- n_estimators = 80, 120, 160, 220, 300, 400, 500
- 총 49조합 비교
- subsample=1.0, colsample_bytree=1.0 고정
- A/B random placement는 데이터 생성 단계에서 이미 완료되었으므로 다시 하지 않음
- Q2+Q4 Train X만으로 scale 계산
- Train으로 학습, Validation으로 선택
- Test는 마지막 모델 비교 전까지 성능 평가하지 않음
- 선택 기준: Validation Log Loss -> Validation Top-1
- 완전 동률이면 더 적은 n_estimators -> 더 작은 learning_rate
"""

from __future__ import annotations

import argparse
import csv
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

DEFAULT_INPUT = ROOT / "ml" / "data" / "q2_q4" / "synthetic_pairwise_q2_q4.csv"
STAGE1_CONFIG = (
    ROOT / "ml" / "artifacts" / "xgboost_q2_q4"
    / "01_max_depth" / "selected_config.json"
)
DEFAULT_OUTPUT = (
    ROOT / "ml" / "artifacts" / "xgboost_q2_q4"
    / "02_lr_trees_wide"
)

LEARNING_RATES = [0.01, 0.02, 0.04, 0.06, 0.10, 0.15, 0.20]
N_ESTIMATORS_VALUES = [80, 120, 160, 220, 300, 400, 500]

FIXED_PARAMS = {
    "subsample": 1.0,
    "colsample_bytree": 1.0,
    "objective": "binary:logistic",
    "eval_metric": "logloss",
    "random_state": 42,
    "n_jobs": 2,
    "tree_method": "hist",
}

OUTPUT_FILES = [
    "selected_model.json",
    "selected_config.json",
    "metadata.json",
    "evaluation.json",
    "lr_trees_comparison.csv",
    "summary.txt",
]


# ------------------------------------------------------------
# 공통
# ------------------------------------------------------------

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_json(path: Path, value) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def prepare_output(output: Path) -> None:
    existing = [output / name for name in OUTPUT_FILES if (output / name).exists()]

    if existing:
        files = "\n".join(str(path) for path in existing)
        raise FileExistsError(
            "기존 02_lr_trees_wide 결과가 있습니다. 자동으로 덮어쓰지 않습니다.\n"
            f"{files}\n"
            "기존 결과를 보존하거나 --output으로 다른 폴더를 지정하세요."
        )

    output.mkdir(parents=True, exist_ok=True)


def load_stage1_config():
    if not STAGE1_CONFIG.is_file():
        raise FileNotFoundError(
            "1단계 selected_config.json을 찾을 수 없습니다.\n"
            f"예상 경로: {STAGE1_CONFIG}\n"
            "01_max_depth.py를 먼저 실행하세요."
        )

    config = json.loads(STAGE1_CONFIG.read_text(encoding="utf-8-sig"))

    if "max_depth" not in config:
        raise ValueError("1단계 selected_config.json에 max_depth가 없습니다.")

    if config.get("test_evaluated") is not False:
        raise ValueError("1단계 설정에서 Test 미평가 상태를 확인할 수 없습니다.")

    max_depth = int(config["max_depth"])

    if max_depth < 1:
        raise ValueError("1단계 max_depth 값이 올바르지 않습니다.")

    return max_depth, config


# ------------------------------------------------------------
# 데이터 검증
# ------------------------------------------------------------

def load_data(input_path: Path):
    if not input_path.is_file():
        raise FileNotFoundError(
            "Q2+Q4 합성데이터를 찾을 수 없습니다.\n"
            f"예상 경로: {input_path}"
        )

    metadata_path = input_path.parent / "metadata.json"

    if not metadata_path.is_file():
        raise FileNotFoundError(
            "Q2+Q4 생성 metadata.json을 찾을 수 없습니다.\n"
            f"예상 경로: {metadata_path}"
        )

    metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))

    if metadata.get("purpose") != "synthetic_q2_q4_common_model_comparison":
        raise ValueError("metadata purpose가 Q2+Q4 공통 모델 비교용이 아닙니다.")

    if list(metadata.get("feature_names", [])) != FEATURES:
        raise ValueError("metadata의 Feature 순서와 현재 features.py의 FEATURES가 다릅니다.")

    expected_hash = metadata.get("output_sha256", {}).get("synthetic_pairwise_q2_q4.csv")

    if not expected_hash:
        raise ValueError("metadata에 Q2+Q4 CSV SHA256이 없습니다.")

    if sha256(input_path) != expected_hash:
        raise ValueError(
            "Q2+Q4 CSV의 SHA256이 생성 metadata와 다릅니다.\n"
            "생성 후 데이터가 변경되었을 수 있으므로 검증을 중단합니다."
        )

    df = pd.read_csv(input_path)

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

    missing = sorted(required - set(df.columns))

    if missing:
        raise ValueError(f"필수 컬럼이 없습니다: {missing}")

    if df.empty:
        raise ValueError("입력 CSV가 비어 있습니다.")

    x = df[FEATURES].to_numpy(dtype=float)

    if not np.isfinite(x).all():
        raise ValueError("X8 Feature에 NaN 또는 inf가 있습니다.")

    if not set(df["split"].unique()).issubset({"train", "validation", "test"}):
        raise ValueError("split은 train / validation / test만 허용합니다.")

    for split in ["train", "validation", "test"]:
        if not (df["split"] == split).any():
            raise ValueError(f"{split} 데이터가 없습니다.")

    if not set(df["y"].unique()).issubset({0, 1}):
        raise ValueError("y는 0 또는 1이어야 합니다.")

    if (df["a"] == df["b"]).any():
        raise ValueError("A와 B 후보가 같은 row가 존재합니다.")

    split_per_search = df.groupby("search_id")["split"].nunique()

    if (split_per_search != 1).any():
        raise ValueError("같은 search_id가 여러 split에 섞여 있습니다.")

    pair_counts = df.groupby("search_id").size()

    if not (pair_counts == 2).all():
        raise ValueError("각 search_id에는 정확히 2개의 pair가 있어야 합니다.")

    weight_sum = df.groupby("search_id")["sample_weight"].sum()

    if not np.allclose(weight_sum.to_numpy(dtype=float), 1.0, rtol=0.0, atol=1e-12):
        raise ValueError("검색별 sample_weight 합이 1이 아닙니다.")

    for column in ["m_time", "m_distance"]:
        values = df[column].to_numpy(dtype=float)

        if not np.isfinite(values).all():
            raise ValueError(f"{column}에 NaN 또는 inf가 있습니다.")

        if ((values < 0.5) | (values > 2.0)).any():
            raise ValueError(f"{column}은 [0.5, 2.0] 범위여야 합니다.")

        if (df.groupby("search_id")[column].nunique() != 1).any():
            raise ValueError(f"같은 search_id 안에서 {column} 값이 다릅니다.")

    search_counts = (
        df[["search_id", "split"]]
        .drop_duplicates()["split"]
        .value_counts()
        .to_dict()
    )

    total = int(df["search_id"].nunique())
    train_count = total * 70 // 100
    validation_count = total * 15 // 100

    expected_counts = {
        "train": train_count,
        "validation": validation_count,
        "test": total - train_count - validation_count,
    }

    if search_counts != expected_counts:
        raise ValueError(
            "search_id 기준 split이 70:15:15가 아닙니다.\n"
            f"실제: {search_counts}\n"
            f"예상: {expected_counts}"
        )

    return df, metadata, metadata_path


# ------------------------------------------------------------
# 대칭 확률
# ------------------------------------------------------------

def probability(model, x):
    x = np.atleast_2d(np.asarray(x, dtype=float))

    p_forward = model.predict_proba(x)[:, 1]
    p_reverse = model.predict_proba(-x)[:, 1]

    return (p_forward + 1.0 - p_reverse) / 2.0


# ------------------------------------------------------------
# Search Top-1
# ------------------------------------------------------------

def row_x(row):
    return np.asarray([getattr(row, feature) for feature in FEATURES], dtype=float)


def infer_chosen_candidate(group):
    chosen = [
        int(row.a if row.y == 1 else row.b)
        for row in group.itertuples(index=False)
    ]

    if len(set(chosen)) != 1:
        raise ValueError(
            f"search_id={group.iloc[0]['search_id']}의 pair들이 "
            "서로 다른 선택 후보를 가리킵니다."
        )

    return chosen[0]


def reconstruct_all_pair_differences(group):
    rows = list(group.itertuples(index=False))

    if len(rows) != 2:
        raise ValueError("검색당 정확히 2개의 pair가 필요합니다.")

    values = {int(rows[0].a): np.zeros(len(FEATURES), dtype=float)}

    changed = True

    while changed:
        changed = False

        for row in rows:
            a = int(row.a)
            b = int(row.b)
            x = row_x(row)

            if a in values and b not in values:
                values[b] = values[a] - x
                changed = True

            elif b in values and a not in values:
                values[a] = values[b] + x
                changed = True

    if set(values) != {0, 1, 2}:
        raise ValueError("두 pair로 후보 0/1/2의 전체 pair 관계를 복원할 수 없습니다.")

    return np.vstack([
        values[0] - values[1],
        values[0] - values[2],
        values[1] - values[2],
    ])


def search_top1(model, frame, scale):
    hits = 0
    total = 0

    for _, group in frame.groupby("search_id", sort=False):
        pair_x = reconstruct_all_pair_differences(group) / scale
        pair_probability = probability(model, pair_x)

        p01, p02, p12 = pair_probability

        scores = np.array([
            p01 + p02,
            (1.0 - p01) + p12,
            (1.0 - p02) + (1.0 - p12),
        ])

        predicted = int(np.argmax(scores))
        chosen = infer_chosen_candidate(group)

        hits += int(predicted == chosen)
        total += 1

    return {
        "top1": hits / total,
        "top1_hits": hits,
        "top1_searches": total,
    }


# ------------------------------------------------------------
# 평가
# ------------------------------------------------------------

def evaluate(model, frame, scale):
    from sklearn.metrics import accuracy_score, log_loss, roc_auc_score

    x = frame[FEATURES].to_numpy(dtype=float) / scale
    y = frame["y"].to_numpy(dtype=int)

    p = probability(model, x)
    prediction = (p >= 0.5).astype(int)

    raw = model.predict_proba(x)[:, 1]
    reverse_raw = model.predict_proba(-x)[:, 1]

    direction_error = float(
        np.max(np.abs(p + probability(model, -x) - 1.0))
    )

    if direction_error > 1e-6:
        raise RuntimeError("대칭화 확률 방향 검사에 실패했습니다.")

    top1 = search_top1(model, frame, scale)

    return {
        "rows": int(len(frame)),
        "searches": int(frame["search_id"].nunique()),
        "accuracy": float(accuracy_score(y, prediction)),
        "roc_auc": float(roc_auc_score(y, p)),
        "log_loss": float(log_loss(y, p, labels=[0, 1])),
        "top1": float(top1["top1"]),
        "top1_hits": int(top1["top1_hits"]),
        "top1_searches": int(top1["top1_searches"]),
        "raw_direction_error_mean": float(np.mean(np.abs(raw + reverse_raw - 1.0))),
        "symmetrized_direction_error_max": direction_error,
    }


# ------------------------------------------------------------
# 실행
# ------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Q2+Q4 XGBoost 2단계: learning_rate × n_estimators 넓은 범위 검증"
    )

    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)

    args = parser.parse_args()

    input_path = args.input.expanduser().resolve()
    output = args.output.expanduser().resolve()

    max_depth, _ = load_stage1_config()
    df, source_metadata, source_metadata_path = load_data(input_path)

    train = df[df["split"] == "train"].copy().reset_index(drop=True)
    validation = df[df["split"] == "validation"].copy().reset_index(drop=True)
    test = df[df["split"] == "test"].copy().reset_index(drop=True)

    # 기존 결과가 있으면 49개 모델 학습 전에 중단.
    prepare_output(output)

    # A/B random placement는 데이터 생성 단계에서 이미 완료됨.
    # 여기서는 다시 A/B를 뒤집지 않는다.

    # Scaling은 Q2+Q4 Train X만 사용.
    train_x_raw = train[FEATURES].to_numpy(dtype=float)
    scale = np.std(train_x_raw, axis=0)
    scale[scale < 1e-12] = 1.0

    if not np.isfinite(scale).all():
        raise ValueError("Train에서 계산한 scale에 NaN 또는 inf가 있습니다.")

    train_x = train_x_raw / scale
    train_y = train["y"].to_numpy(dtype=int)
    train_weight = train["sample_weight"].to_numpy(dtype=float)

    if np.unique(train_y).size != 2:
        raise ValueError("Train y에는 0과 1이 모두 있어야 합니다.")

    if np.unique(validation["y"].to_numpy(dtype=int)).size != 2:
        raise ValueError("Validation y에는 0과 1이 모두 있어야 합니다.")

    try:
        import sklearn
        import xgboost
        from xgboost import XGBClassifier
    except ImportError as error:
        raise SystemExit(
            "학습 패키지가 없습니다.\n"
            "python -m pip install -r ml/requirements.txt 를 먼저 실행하세요."
        ) from error

    total_combinations = len(LEARNING_RATES) * len(N_ESTIMATORS_VALUES)

    print("[XGBoost Q2+Q4 learning_rate × n_estimators 2차 넓은 검증]")
    print("입력:", input_path)
    print("Train:", train["search_id"].nunique(), "searches /", len(train), "rows")
    print("Validation:", validation["search_id"].nunique(), "searches /", len(validation), "rows")
    print("Test:", test["search_id"].nunique(), "searches /", len(test), "rows (성능 미평가)")
    print("1단계 선택 max_depth:", max_depth)
    print("learning_rate:", LEARNING_RATES)
    print("n_estimators:", N_ESTIMATORS_VALUES)
    print("총 조합:", total_combinations)
    print("고정: subsample=1.0, colsample_bytree=1.0")
    print("선택: Validation Log Loss -> Validation Top-1")

    results = []
    models = {}
    current = 0

    for learning_rate in LEARNING_RATES:
        for n_estimators in N_ESTIMATORS_VALUES:
            current += 1

            print(
                f"\n[{current}/{total_combinations}] "
                f"learning_rate={learning_rate}, "
                f"n_estimators={n_estimators} 학습 중...",
                flush=True,
            )

            params = {
                "max_depth": max_depth,
                "learning_rate": learning_rate,
                "n_estimators": n_estimators,
                **FIXED_PARAMS,
            }

            model = XGBClassifier(**params)
            model.fit(train_x, train_y, sample_weight=train_weight)

            train_metrics = evaluate(model, train, scale)
            validation_metrics = evaluate(model, validation, scale)

            row = {
                "learning_rate": learning_rate,
                "n_estimators": n_estimators,
                "params": params,
                "train": train_metrics,
                "validation": validation_metrics,
            }

            results.append(row)
            models[(learning_rate, n_estimators)] = model

            print(
                f"Train Log Loss={train_metrics['log_loss']:.6f} / "
                f"Validation Log Loss={validation_metrics['log_loss']:.6f} / "
                f"Top-1={validation_metrics['top1']:.2%} "
                f"({validation_metrics['top1_hits']}/{validation_metrics['top1_searches']})"
            )

    selected = min(
        results,
        key=lambda row: (
            row["validation"]["log_loss"],
            -row["validation"]["top1"],
            row["n_estimators"],
            row["learning_rate"],
        ),
    )

    selected_learning_rate = float(selected["learning_rate"])
    selected_n_estimators = int(selected["n_estimators"])
    selected_model = models[(selected_learning_rate, selected_n_estimators)]

    selected_model_path = output / "selected_model.json"
    selected_model.save_model(str(selected_model_path))

    restored = XGBClassifier()
    restored.load_model(str(selected_model_path))

    validation_x = validation[FEATURES].to_numpy(dtype=float) / scale

    if not np.allclose(
        probability(selected_model, validation_x),
        probability(restored, validation_x),
    ):
        raise RuntimeError("저장 전후 모델의 Validation 예측값이 다릅니다.")

    report = {
        "stage": "lr_trees_wide_q2_q4_validation",
        "comparison_scope": "train_validation_only",
        "input_file": str(input_path),
        "input_sha256": sha256(input_path),
        "source_metadata_sha256": sha256(source_metadata_path),
        "stage1_config_file": str(STAGE1_CONFIG),
        "stage1_config_sha256": sha256(STAGE1_CONFIG),
        "features": FEATURES,
        "fixed_max_depth": max_depth,
        "fixed_params": FIXED_PARAMS,
        "learning_rate_values": LEARNING_RATES,
        "n_estimators_values": N_ESTIMATORS_VALUES,
        "total_combinations": total_combinations,
        "selection_rule": (
            "validation_log_loss_then_top1_"
            "then_fewer_trees_then_lower_learning_rate"
        ),
        "sample_weight_policy": "CSV sample_weight = 1 / pairs_per_search",
        "scale_basis": "Train Q2+Q4 X only; np.std(axis=0); center=False",
        "probability": "(p(x)+1-p(-x))/2",
        "ranking": "probability_sum",
        "train_placement": "already_randomized_in_synthetic_generator",
        "placement_seed": source_metadata.get("placement_seed"),
        "train_reverse_augmentation": False,
        "test": {
            "evaluated": False,
            "rows": int(len(test)),
            "searches": int(test["search_id"].nunique()),
        },
        "synthetic_note": (
            "m_time/m_distance는 실제 Q4 4문항 fit 결과가 아니라 합성 프로필이다. "
            "실제 사용자 성능으로 해석하지 않는다."
        ),
        "results": results,
        "selected_max_depth": max_depth,
        "selected_learning_rate": selected_learning_rate,
        "selected_n_estimators": selected_n_estimators,
        "selected_validation_log_loss": selected["validation"]["log_loss"],
        "selected_validation_top1": selected["validation"]["top1"],
        "versions": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "xgboost": xgboost.__version__,
            "sklearn": sklearn.__version__,
        },
    }

    save_json(output / "evaluation.json", report)

    save_json(
        output / "selected_config.json",
        {
            "max_depth": max_depth,
            "learning_rate": selected_learning_rate,
            "n_estimators": selected_n_estimators,
            **FIXED_PARAMS,
            "selection_rule": report["selection_rule"],
            "stage1_config_sha256": report["stage1_config_sha256"],
            "test_evaluated": False,
        },
    )

    save_json(
        output / "metadata.json",
        {
            "features": FEATURES,
            "scale": scale.tolist(),
            "center": False,
            "scale_basis": report["scale_basis"],
            "probability": "(p(x)+1-p(-x))/2",
            "ranking": "probability_sum",
            "sample_weight_policy": report["sample_weight_policy"],
            "training_source": source_metadata.get("training_source"),
            "real_user_validated": source_metadata.get("real_user_validated"),
            "test_evaluated": False,
            "versions": report["versions"],
        },
    )

    comparison_rows = []

    for row in results:
        result = {
            "max_depth": max_depth,
            "learning_rate": row["learning_rate"],
            "n_estimators": row["n_estimators"],
        }

        for split in ["train", "validation"]:
            for key, value in row[split].items():
                result[f"{split}_{key}"] = value

        result["validation_minus_train_log_loss"] = (
            row["validation"]["log_loss"] - row["train"]["log_loss"]
        )

        result["selected"] = (
            row["learning_rate"] == selected_learning_rate
            and row["n_estimators"] == selected_n_estimators
        )

        comparison_rows.append(result)

    with (output / "lr_trees_comparison.csv").open(
        "w", encoding="utf-8-sig", newline=""
    ) as file:
        writer = csv.DictWriter(file, fieldnames=list(comparison_rows[0].keys()))
        writer.writeheader()
        writer.writerows(comparison_rows)

    lines = [
        "[XGBoost Q2+Q4 learning_rate × n_estimators 2차 넓은 검증]",
        "",
        f"입력 데이터: {input_path}",
        "",
        "1단계 선택값",
        f"- max_depth = {max_depth}",
        "",
        "고정 하이퍼파라미터",
        "- subsample = 1.0",
        "- colsample_bytree = 1.0",
        "",
        "비교 learning_rate",
        "- 0.01, 0.02, 0.04, 0.06, 0.10, 0.15, 0.20",
        "",
        "비교 n_estimators",
        "- 80, 120, 160, 220, 300, 400, 500",
        "",
        f"총 조합: {total_combinations}",
        "",
        "선택 기준",
        "- 1순위: Validation Log Loss",
        "- 2순위: Validation Top-1",
        "- 정확한 동률: 더 적은 n_estimators",
        "- 이후 동률: 더 작은 learning_rate",
        "- Test는 평가하지 않음",
        "",
        "결과",
        (
            "learning_rate | n_estimators | Train Log Loss | "
            "Validation Log Loss | Validation Top-1 | "
            "Validation ROC-AUC | Validation Accuracy"
        ),
    ]

    for row in results:
        val = row["validation"]

        lines.append(
            f"{row['learning_rate']:.3f} | "
            f"{row['n_estimators']} | "
            f"{row['train']['log_loss']:.6f} | "
            f"{val['log_loss']:.6f} | "
            f"{val['top1']:.2%} ({val['top1_hits']}/{val['top1_searches']}) | "
            f"{val['roc_auc']:.6f} | "
            f"{val['accuracy']:.2%}"
        )

    val = selected["validation"]

    lines.extend([
        "",
        "선택 결과",
        f"max_depth: {max_depth}",
        f"learning_rate: {selected_learning_rate}",
        f"n_estimators: {selected_n_estimators}",
        f"Validation Log Loss: {val['log_loss']:.6f}",
        f"Validation Top-1: {val['top1']:.2%} ({val['top1_hits']}/{val['top1_searches']})",
        f"Validation ROC-AUC: {val['roc_auc']:.6f}",
        f"Validation Accuracy: {val['accuracy']:.2%}",
        "",
    ])

    summary = "\n".join(lines) + "\n"
    (output / "summary.txt").write_text(summary, encoding="utf-8")

    print()
    print(summary)
    print("결과 폴더:", output)


if __name__ == "__main__":
    main()