"""Pairwise Logistic Regression for the common synthetic CSV dataset.

Uses the CSV's existing split, A/B orientation and Y labels unchanged so the
same rows can be compared fairly with another model (e.g. XGBoost).
"""
from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.exceptions import ConvergenceWarning
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score
from sklearn.model_selection import ParameterGrid
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "time_diff",
    "distance_diff",
    "intersection_weighted_diff",
    "merge_weighted_diff",
    "narrow_weighted_diff",
    "turn_weighted_diff",
    "consecutive_weighted_diff",
    "child_100m_weighted_diff",
]
REQUIRED_COLUMNS = ["search_id", "split", "a", "b", "y", *FEATURES]
SPLITS = ("train", "validation", "test")


def load_dataset(csv_path: Path, metadata_path: Path | None = None) -> tuple[pd.DataFrame, dict]:
    df = pd.read_csv(csv_path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"필수 컬럼이 없습니다: {missing}")

    extra_splits = set(df["split"].dropna().unique()) - set(SPLITS)
    if extra_splits:
        raise ValueError(f"알 수 없는 split이 있습니다: {sorted(extra_splits)}")
    if any((df["split"] == s).sum() == 0 for s in SPLITS):
        raise ValueError("train/validation/test가 모두 필요합니다.")
    if not set(df["y"].unique()).issubset({0, 1}):
        raise ValueError("y는 0/1이어야 합니다.")
    if not set(df["a"].unique()).issubset({0, 1, 2}) or not set(df["b"].unique()).issubset({0, 1, 2}):
        raise ValueError("a/b는 0,1,2 후보 index여야 합니다.")
    if (df["a"] == df["b"]).any():
        raise ValueError("a와 b는 서로 다른 후보여야 합니다.")
    if not np.isfinite(df[FEATURES].to_numpy(float)).all():
        raise ValueError("X8에 NaN/inf가 있습니다.")

    # 같은 search_id가 split을 넘나들면 누수다.
    split_per_search = df.groupby("search_id")["split"].nunique()
    if (split_per_search != 1).any():
        raise ValueError("동일 search_id가 여러 split에 섞여 있습니다.")

    # 현재 공통 데이터 계약: 검색당 selected-vs-unselected pair 2개.
    pair_counts = df.groupby("search_id").size()
    if not (pair_counts == 2).all():
        raise ValueError("각 search_id에는 정확히 2개 pair가 있어야 합니다.")

    metadata = {}
    if metadata_path is not None:
        metadata = json.loads(Path(metadata_path).read_text(encoding="utf-8-sig"))
        if metadata.get("feature_names") and metadata["feature_names"] != FEATURES:
            raise ValueError("metadata feature_names와 코드 FEATURES 순서가 다릅니다.")
        expected_rows = metadata.get("pair_row_count")
        if expected_rows is not None and int(expected_rows) != len(df):
            raise ValueError("metadata pair_row_count와 CSV 행 수가 다릅니다.")
        expected_split = metadata.get("split_pair_counts", {})
        for split, count in expected_split.items():
            actual = int((df["split"] == split).sum())
            if actual != int(count):
                raise ValueError(f"metadata의 {split} pair 수와 CSV가 다릅니다.")
    return df, metadata


def parameter_grid(c_values: list[float]) -> dict:
    return {
        "C": c_values,
        "penalty": ["l1", "l2"],
        "solver": ["lbfgs", "liblinear"],
        "class_weight": [None, "balanced"],
        "max_iter": [1000, 3000],
    }


def valid_parameter_combinations(c_values: list[float]) -> list[dict]:
    combos = []
    for p in ParameterGrid(parameter_grid(c_values)):
        if p["penalty"] == "l1" and p["solver"] == "lbfgs":
            continue
        combos.append(p)
    return combos


def make_pipeline(params: dict, seed: int) -> Pipeline:
    # with_mean=False + fit_intercept=False => X와 -X의 pairwise 대칭성 유지.
    return Pipeline([
        ("scaler", StandardScaler(with_mean=False)),
        ("model", LogisticRegression(
            C=params["C"],
            penalty=params["penalty"],
            solver=params["solver"],
            class_weight=params["class_weight"],
            max_iter=params["max_iter"],
            fit_intercept=False,
            random_state=seed,
            tol=1e-8,
        )),
    ])


def infer_chosen_candidate(search_rows: pd.DataFrame) -> int:
    chosen = []
    for r in search_rows.itertuples(index=False):
        chosen.append(int(r.a if r.y == 1 else r.b))
    if len(set(chosen)) != 1:
        raise ValueError(f"search_id={search_rows.iloc[0]['search_id']}의 Y가 서로 모순됩니다.")
    return chosen[0]


def _row_x(row) -> np.ndarray:
    if hasattr(row, "x"):
        return np.asarray(row.x, dtype=float)
    return np.asarray([getattr(row, f) for f in FEATURES], dtype=float)


def reconstruct_all_pair_differences(search_rows: pd.DataFrame) -> dict[tuple[int, int], np.ndarray]:
    """두 관측 edge만으로 3개 후보의 모든 A-B feature 차이를 복원한다.

    Y는 사용하지 않는다. 각 row의 (a,b,x=f[a]-f[b]) 관계만 이용한다.
    """
    rows = list(search_rows.itertuples(index=False))
    if len(rows) != 2:
        raise ValueError("검색당 2개 pair가 필요합니다.")

    dim = len(_row_x(rows[0]))
    values: dict[int, np.ndarray] = {int(rows[0].a): np.zeros(dim, dtype=float)}

    changed = True
    while changed:
        changed = False
        for r in rows:
            a, b, x = int(r.a), int(r.b), _row_x(r)
            if a in values and b not in values:
                values[b] = values[a] - x
                changed = True
            elif b in values and a not in values:
                values[a] = values[b] + x
                changed = True

    if set(values) != {0, 1, 2}:
        raise ValueError("두 pair가 세 후보를 연결하지 못합니다.")

    return {
        (0, 1): values[0] - values[1],
        (0, 2): values[0] - values[2],
        (1, 2): values[1] - values[2],
    }


def symmetric_a_probability(pipeline: Pipeline, x: np.ndarray) -> np.ndarray:
    x = np.atleast_2d(np.asarray(x, dtype=float))
    p_forward = pipeline.predict_proba(x)[:, 1]
    p_reverse = pipeline.predict_proba(-x)[:, 1]
    return (p_forward + (1.0 - p_reverse)) / 2.0


def evaluate_pairs(pipeline: Pipeline, df: pd.DataFrame) -> dict:
    x = df[FEATURES].to_numpy(float)
    y = df["y"].to_numpy(int)
    p = symmetric_a_probability(pipeline, x)
    raw = pipeline.predict_proba(x)[:, 1]
    rev = pipeline.predict_proba(-x)[:, 1]
    return {
        "pair_accuracy": float(accuracy_score(y, p >= 0.5)),
        "roc_auc": float(roc_auc_score(y, p)) if len(np.unique(y)) == 2 else None,
        "log_loss": float(log_loss(y, p, labels=[0, 1])),
        "direction_error_max": float(np.max(np.abs(raw + rev - 1.0))),
    }


def evaluate_top1(pipeline: Pipeline, df: pd.DataFrame) -> tuple[float, list[dict]]:
    # 모든 검색의 3개 비교를 먼저 모아 predict_proba를 한 번에 호출한다.
    search_info = []
    feature_blocks = []
    for search_id, rows in df.groupby("search_id", sort=False):
        diffs = reconstruct_all_pair_differences(rows)
        feature_blocks.append(np.vstack([
            diffs[(0, 1)],
            diffs[(0, 2)],
            diffs[(1, 2)],
        ]))
        search_info.append((int(search_id), infer_chosen_candidate(rows)))

    all_x = np.vstack(feature_blocks)
    all_prob = symmetric_a_probability(pipeline, all_x).reshape(-1, 3)

    predictions = []
    correct = 0
    for (search_id, chosen), (p01, p02, p12) in zip(search_info, all_prob):
        p01, p02, p12 = float(p01), float(p02), float(p12)
        matrix = np.array([
            [0.5, p01, p02],
            [1 - p01, 0.5, p12],
            [1 - p02, 1 - p12, 0.5],
        ])
        scores = matrix.sum(axis=1) - 0.5  # 확률 합산 방식
        predicted = int(np.argmax(scores))
        correct += int(predicted == chosen)
        predictions.append({
            "search_id": search_id,
            "chosen_candidate": chosen,
            "predicted_candidate": predicted,
            "sum_scores": scores.tolist(),
            "p01": p01,
            "p02": p02,
            "p12": p12,
        })
    return correct / len(predictions), predictions


def evaluate(pipeline: Pipeline, df: pd.DataFrame) -> tuple[dict, list[dict]]:
    metrics = evaluate_pairs(pipeline, df)
    top1, predictions = evaluate_top1(pipeline, df)
    metrics["top1_accuracy"] = float(top1)
    metrics["search_count"] = len(predictions)
    return metrics, predictions


def train_and_select(df: pd.DataFrame, c_values: list[float], seed: int = 42):
    train = df[df["split"] == "train"].copy()
    val = df[df["split"] == "validation"].copy()

    x_train = train[FEATURES].to_numpy(float)
    y_train = train["y"].to_numpy(int)
    counts = train.groupby("search_id")["search_id"].transform("count").to_numpy(float)
    sample_weight = 1.0 / counts

    results = []
    skipped = []
    best = None
    best_params = None
    best_key = None

    for params in valid_parameter_combinations(c_values):
        pipeline = make_pipeline(params, seed)
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always", ConvergenceWarning)
            pipeline.fit(x_train, y_train, model__sample_weight=sample_weight)
        if any(issubclass(w.category, ConvergenceWarning) for w in caught):
            skipped.append({"parameters": params, "reason": "did_not_converge"})
            continue

        metrics, _ = evaluate(pipeline, val)
        results.append({"parameters": params, **metrics})
        # 주 선택 기준: validation Log Loss. 동률이면 Top-1, 작은 C, 작은 max_iter.
        key = (metrics["log_loss"], -metrics["top1_accuracy"], params["C"], params["max_iter"])
        if best_key is None or key < best_key:
            best_key = key
            best = pipeline
            best_params = params

    if best is None:
        raise RuntimeError("수렴한 Logistic 후보가 없습니다.")
    return best, best_params, results, skipped


def json_ready(value):
    if isinstance(value, dict):
        return {str(k): json_ready(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_ready(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    return value


def save_outputs(output: Path, pipeline: Pipeline, report: dict, val_pred: list[dict], test_pred: list[dict]):
    output.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, output / "logistic_model.joblib")
    (output / "metrics.json").write_text(
        json.dumps(json_ready(report), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output / "validation_predictions.json").write_text(
        json.dumps(json_ready(val_pred), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output / "test_predictions.json").write_text(
        json.dumps(json_ready(test_pred), ensure_ascii=False, indent=2), encoding="utf-8"
    )

    grid_rows = []
    for r in report["validation_grid"]:
        row = {**r["parameters"]}
        row.update({
            "pair_accuracy": r["pair_accuracy"],
            "roc_auc": r["roc_auc"],
            "log_loss": r["log_loss"],
            "top1_accuracy": r["top1_accuracy"],
            "direction_error_max": r["direction_error_max"],
        })
        grid_rows.append(row)
    pd.DataFrame(grid_rows).to_csv(output / "validation_grid.csv", index=False, encoding="utf-8-sig")

    scaler = pipeline.named_steps["scaler"]
    model = pipeline.named_steps["model"]
    pd.DataFrame({
        "feature": FEATURES,
        "beta_on_scaled_X": model.coef_[0],
        "train_standard_deviation": scaler.scale_,
    }).to_csv(output / "coefficients.csv", index=False, encoding="utf-8-sig")


def main():
    parser = argparse.ArgumentParser(description="공통 CSV로 Pairwise Logistic Regression 학습/평가")
    parser.add_argument("--data", type=Path, default=Path(__file__).with_name("synthetic_pairwise_child100.csv"))
    parser.add_argument("--metadata", type=Path, default=Path(__file__).with_name("metadata.json"))
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("logistic_artifacts"))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--c-values", type=float, nargs="+", default=[0.01, 0.1, 1, 10, 100])
    args = parser.parse_args()

    df, metadata = load_dataset(args.data, args.metadata)
    model, best_params, grid, skipped = train_and_select(df, args.c_values, args.seed)

    val = df[df["split"] == "validation"].copy()
    test = df[df["split"] == "test"].copy()
    val_metrics, val_pred = evaluate(model, val)
    test_metrics, test_pred = evaluate(model, test)

    report = {
        "data": {
            "rows": len(df),
            "searches": int(df["search_id"].nunique()),
            "split_pair_counts": df["split"].value_counts().to_dict(),
            "metadata": metadata,
        },
        "configuration": {
            "seed": args.seed,
            "features": FEATURES,
            "orientation": "use_csv_as_is",
            "scaler": "StandardScaler(with_mean=False), fit on train only",
            "fit_intercept": False,
            "selection_metric": "validation_log_loss_then_top1",
            "aggregation": "sum_pair_probability",
            "best_parameters": best_params,
            "valid_grid_count": len(valid_parameter_combinations(args.c_values)),
        },
        "validation_grid": grid,
        "skipped_candidates": skipped,
        "validation": val_metrics,
        "test": test_metrics,
    }
    save_outputs(args.output, model, report, val_pred, test_pred)

    print(f"유효 하이퍼파라미터 조합: {len(valid_parameter_combinations(args.c_values))}개")
    print(f"선택 설정: {best_params}")
    for name, metrics in (("validation", val_metrics), ("test", test_metrics)):
        print(
            f"{name}: Pair Accuracy {metrics['pair_accuracy']:.2%}, "
            f"ROC-AUC {metrics['roc_auc']:.5f}, "
            f"Log Loss {metrics['log_loss']:.5f}, "
            f"3경로 Top-1 {metrics['top1_accuracy']:.2%}"
        )
    print(f"저장 위치: {args.output.resolve()}")


if __name__ == "__main__":
    main()
