"""최종 Logistic이 선택 후 Train+Validation만 재학습하는지 검증한다.

잡아내려는 회귀: 최고 설정을 Train 모델 그대로 저장하거나, 최종 재학습에
Test를 섞어서 scaler/계수에 테스트 데이터가 누수되는 문제.
"""
from __future__ import annotations

from pathlib import Path
import sys

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml/src"))

from logistic_model import FEATURES, refit_final_model


rows = []
for search_id, split, magnitude in (
    (1, "train", 1.0),
    (2, "train", 2.0),
    (3, "validation", 3.0),
    (4, "test", 4.0),
):
    for pair_index, y in enumerate((0, 1)):
        row = {
            "search_id": search_id,
            "split": split,
            "a": 0,
            "b": pair_index + 1,
            "y": y,
        }
        row.update({feature: magnitude * (index + 1) * (-1 if pair_index else 1)
                    for index, feature in enumerate(FEATURES)})
        rows.append(row)

frame = pd.DataFrame(rows)
params = {
    "C": 1.0,
    "penalty": "l2",
    "solver": "liblinear",
    "class_weight": None,
    "max_iter": 1000,
}
model = refit_final_model(frame, params, seed=42)
assert int(model.named_steps["scaler"].n_samples_seen_) == 6

changed_test = frame.copy()
changed_test.loc[changed_test["split"] == "test", FEATURES] *= 1_000_000
model_with_changed_test = refit_final_model(changed_test, params, seed=42)
np.testing.assert_array_equal(
    model.named_steps["scaler"].scale_,
    model_with_changed_test.named_steps["scaler"].scale_,
)
np.testing.assert_array_equal(
    model.named_steps["model"].coef_,
    model_with_changed_test.named_steps["model"].coef_,
)

print("PASS: final Logistic refit uses 6 Train+Validation rows and excludes Test")
