"""Git 공통 simulated Q2+Q4 데이터에서 Q4 fitted 추가 실험을 파생한다.

검색·경로·Q2·split·A/B·Y·sample weight·X2~X7은 원본 그대로 보존하고,
원본 simulated multiplier로 Q4 응답 4개를 만든 뒤 fitTrial이 추정한
multiplier로 X0/X1만 다시 계산한다. 공통 데이터 자체는 수정하지 않는다.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import csv
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys

import numpy as np

import generate_synthetic_q2_q4 as base
from q2_q4_features import FEATURES


ROOT = base.ROOT
SOURCE_FILENAMES = (
    "synthetic_pairwise_q2_q4.csv",
    "synthetic_pairwise_q2_control.csv",
    "synthetic_searches_q2_q4.json",
    "metadata.json",
)
PRESERVED_COLUMNS = (
    "search_id", "split", "a", "b", "y", "sample_weight",
    *FEATURES[2:],
)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def csv_rows(content: bytes) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))


def load_source(source: Path) -> tuple[list[dict], list[dict[str, str]], dict, dict[str, str]]:
    source = source.resolve()
    for name in SOURCE_FILENAMES:
        base.require((source / name).is_file(), f"SOURCE_FILE_MISSING: {source / name}")

    file_hashes = {name: base.sha256(source / name) for name in SOURCE_FILENAMES}
    metadata = json.loads((source / "metadata.json").read_text(encoding="utf-8-sig"))
    expected_hashes = metadata.get("output_sha256", {})
    for name, expected in expected_hashes.items():
        base.require(name in file_hashes and file_hashes[name] == expected,
                     f"SOURCE_HASH_MISMATCH: {name}")
    base.require(metadata.get("training_source") == "SYNTHETIC_Q2_Q4_PROFILE",
                 "SOURCE_MUST_BE_COMMON_SIMULATED_Q2_Q4_DATA")
    base.require(metadata.get("q4_profile", {}).get("mode") == "simulated",
                 "SOURCE_Q4_MODE_MUST_BE_SIMULATED")

    events = json.loads(
        (source / "synthetic_searches_q2_q4.json").read_text(encoding="utf-8-sig")
    )
    rows = read_csv(source / "synthetic_pairwise_q2_q4.csv")
    base.require(len(events) == metadata.get("search_count"), "SOURCE_SEARCH_COUNT_MISMATCH")
    base.require(len(rows) == metadata.get("pair_row_count"), "SOURCE_PAIR_COUNT_MISMATCH")
    return events, rows, metadata, file_hashes


def fit_profiles_from_source(events: list[dict], response_seed: int) -> dict:
    """원본 simulated multiplier를 숨은 성향으로 사용해 응답을 만들고 재추정한다."""
    records = []
    for event in events:
        source_profile = deepcopy(event["q4_profile"])
        factor = source_profile.get("reference_factor")
        base.require(
            all(0.5 <= float(source_profile[key]) <= 2.0 for key in ("m_time", "m_distance")),
            "SOURCE_MULTIPLIER_OUT_OF_BOUNDS",
        )
        event["q4_source_profile"] = source_profile
        records.append({
            "searchId": event["search_id"],
            "responseSeed": response_seed,
            "referenceFactor": factor or "NARROW_ROAD",
            "referenceSource": "Q2_TOP" if factor else "DEFAULT_REFERENCE",
            "q2Weights": event["weights"],
            "latentMultipliers": [source_profile["m_time"], source_profile["m_distance"]],
        })

    completed = subprocess.run(
        ["node", str(ROOT / "scripts/synthesize-q4-profiles.mjs")],
        cwd=ROOT,
        input=json.dumps({"records": records}),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )
    payload = json.loads(completed.stdout)
    profiles = {profile["searchId"]: profile for profile in payload["profiles"]}
    base.require(len(profiles) == len(events), "Q4_PROFILE_COUNT_MISMATCH")

    for event in events:
        profile = profiles[event["search_id"]]
        event["q4_responses"] = profile["responses"]
        event["q4_profile"] = {
            "m_time": profile["multipliers"][0],
            "m_distance": profile["multipliers"][1],
            "reference_factor": event["q4_source_profile"].get("reference_factor"),
            "status": profile["status"],
            "reason": profile["reason"],
            "usable_answers": profile["usable"],
            "design": profile["design"],
            "baseline_loss": profile["baselineLoss"],
            "fitted_loss": profile["fittedLoss"],
            "source": "SYNTHETIC_Q4_RESPONSES_FIT",
        }
        event["source"] = "q4_fitted_additional_experiment_from_common_data"
    return payload["metadata"]


def validate_source_comparison(
    source_events: list[dict],
    fitted_events: list[dict],
    source_rows: list[dict[str, str]],
    fitted_rows: list[dict[str, str]],
) -> dict:
    base.require(len(source_events) == len(fitted_events), "DERIVED_SEARCH_COUNT_CHANGED")
    base.require(len(source_rows) == len(fitted_rows), "DERIVED_PAIR_COUNT_CHANGED")

    for before, after in zip(source_events, fitted_events):
        for key in ("search_id", "split", "weights", "routes", "chosen", "choice_noise"):
            base.require(before[key] == after[key], f"DERIVED_SEARCH_FIELD_CHANGED: {key}")
        base.require(after["q4_source_profile"] == before["q4_profile"],
                     "SOURCE_Q4_PROFILE_NOT_PRESERVED")

    changed_x01 = 0
    for before, after in zip(source_rows, fitted_rows):
        for column in PRESERVED_COLUMNS:
            base.require(before[column] == after[column], f"DERIVED_COLUMN_CHANGED: {column}")
        changed_x01 += int(
            before[FEATURES[0]] != after[FEATURES[0]]
            or before[FEATURES[1]] != after[FEATURES[1]]
        )
    base.require(changed_x01 > 0, "FITTED_MULTIPLIER_DID_NOT_CHANGE_X0_OR_X1")
    return {
        "source_comparison": "passed",
        "preserved_pair_rows": len(fitted_rows),
        "rows_with_changed_x0_or_x1": changed_x01,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "ml/data/q2_q4")
    parser.add_argument("--q4-response-seed", type=int, default=20260918)
    parser.add_argument("--output", type=Path, default=ROOT / "ml/data/q2_q4_fitted")
    args = parser.parse_args()
    base.require(args.q4_response_seed >= 0, "Q4_RESPONSE_SEED_MUST_BE_NONNEGATIVE")

    source_events, source_rows, source_metadata, source_hashes = load_source(args.source)
    events = deepcopy(source_events)
    trial_metadata = fit_profiles_from_source(events, args.q4_response_seed)

    placement_seed = int(source_metadata["placement_seed"])
    rows, controls = base.make_pairs(events, placement_seed)
    dataset_validation = base.validate_dataset(events, rows, controls)
    pair_content = base.csv_bytes(rows)
    comparison = validate_source_comparison(
        source_events, events, source_rows, csv_rows(pair_content)
    )
    files = {
        "synthetic_pairwise_q2_q4.csv": pair_content,
        "synthetic_pairwise_q2_control.csv": base.csv_bytes(controls),
        "synthetic_searches_q2_q4.json": base.json_bytes(events),
    }

    bank_path = ROOT / "apps/backend/src/config/q4Cases.json"
    code_paths = [
        Path(__file__),
        ROOT / "ml/q4-trial.mjs",
        ROOT / "ml/q4-synthetic-profiles.mjs",
        ROOT / "scripts/synthesize-q4-profiles.mjs",
        Path(base.__file__).with_name("q2_q4_features.py"),
    ]
    status_counts = Counter(event["q4_profile"]["status"] for event in events)
    reason_counts = Counter(event["q4_profile"]["reason"] for event in events)
    metadata = {
        "purpose": "q4_fitted_multiplier_additional_experiment",
        "training_source": "DERIVED_FROM_COMMON_SYNTHETIC_Q2_Q4_DATA",
        "real_user_validated": False,
        "model_not_run": True,
        "scaler_fitted": False,
        "search_count": len(events),
        "pair_row_count": len(rows),
        "candidate_count_per_search": source_metadata["candidate_count_per_search"],
        "pair_rows_per_search": source_metadata["pair_rows_per_search"],
        "split_search_counts": dataset_validation["split_search_counts"],
        "split_pair_counts": dataset_validation["split_pair_counts"],
        "placement_seed": placement_seed,
        "q4_response_seed": args.q4_response_seed,
        "feature_names": FEATURES,
        "factor_order": source_metadata["factor_order"],
        "raw6_units": source_metadata["raw6_units"],
        "feature_version": source_metadata["feature_version"],
        "contract_version": source_metadata["contract_version"],
        "csv_audit_columns_not_model_features": ["sample_weight", "m_time", "m_distance"],
        "source_dataset": {
            "purpose": source_metadata["purpose"],
            "training_source": source_metadata["training_source"],
            "output_sha256": source_hashes,
        },
        "preserved_from_source": [
            "search_id", "split", "routes", "q2_weights", "a_b_placement",
            "y", "sample_weight", "x2_to_x7",
        ],
        "changed_from_source": [
            "q4_responses", "m_time", "m_distance", "x0_time_diff", "x1_distance_diff",
        ],
        "label_policy": {
            "y": "preserved exactly from common simulated Q2+Q4 source",
            "no_choice_regeneration": True,
            "source_simulated_multiplier_used_only_as_hidden_preference_for_response_generation": True,
        },
        "q4_profile": {
            "mode": "fitted-responses-additional-experiment",
            "fit_from_synthetic_q4_answers": True,
            "answers_per_search": 4,
            "answer_values": ["A", "B"],
            "bounds": [0.5, 2.0],
            "fallback": "[1,1] under fitTrial policy or unvalidated/no-Q2 reference",
            "status_counts": dict(status_counts),
            "reason_counts": dict(reason_counts),
            "bank_version": trial_metadata["caseSetVersion"],
            "bank_sha256": base.sha256(bank_path),
            "estimator_version": trial_metadata["estimatorVersion"],
            "estimator_model_version": trial_metadata["modelVersion"],
            "estimator_model_hash": trial_metadata["modelHash"],
            "trial_policy_executed": trial_metadata["policy"],
        },
        "pair_policy": source_metadata["pair_policy"],
        "sample_weight_policy": source_metadata["sample_weight_policy"],
        "validation": {**dataset_validation, **comparison},
        "versions": {"python": sys.version.split()[0], "numpy": np.__version__},
        "code_sha256": {path.name: base.sha256(path) for path in code_paths},
        "output_sha256": {
            name: hashlib.sha256(content).hexdigest() for name, content in files.items()
        },
        "warning": "Synthetic four-answer Q4 sensitivity experiment only; not real-user validation.",
    }
    files["metadata.json"] = base.json_bytes(metadata)
    base.save_outputs(args.output.resolve(), files)

    print(f"PASS: derived Q4 fitted experiment / searches={len(events):,} / pair rows={len(rows):,}")
    print("Source comparison:", comparison)
    print("Q4 profile status:", dict(status_counts))
    print("Output:", args.output.resolve())
    print("Common source data preserved; only fitted Q4 experiment data was written.")


if __name__ == "__main__":
    main()
