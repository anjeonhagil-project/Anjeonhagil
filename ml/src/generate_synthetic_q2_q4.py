"""Q2+Q4 합성데이터 생성. 기본 3,000 searches / 6,000 pair rows / 70:15:15.

실행: python -B ml/src/generate_synthetic_q2_q4.py
출력: ml/data/q2_q4/ (기존 파일 덮어쓰기 금지, 동일 결과 재실행은 재사용)
의존성: numpy, 같은 폴더의 q2_q4_features.py 및 기존 features.py/inference.py.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sys

import numpy as np

from features import candidate_vector
from q2_q4_features import (
    FEATURES, MULTIPLIER_MIN, MULTIPLIER_MAX, build_q2_q4_features,
)

ROOT = Path(__file__).resolve().parents[2]
SPLITS = ("train", "validation", "test")
FACTORS = ("COMPLEX_INTERSECTION", "MERGE_BRANCH", "NARROW_ROAD",
           "UNFAMILIAR_TURN", "CONSECUTIVE_ACTION", "CHILD_ZONE_NEARBY")
UNITS = ("count", "score*m", "score*m", "count", "count", "m")
ORIGINAL_GENERATOR_SHA256 = "1d7cc7da601f2b6de63fa971bbbc7a1d7e964c907a09273bbaf30bd273219293"
CSV_COLUMNS = ["search_id", "split", "a", "b", "y", *FEATURES,
               "sample_weight", "m_time", "m_distance"]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def survey_weights(rng):
    k = int(rng.integers(0, 7))
    w = np.zeros(6, dtype=float)
    if k:
        order = rng.permutation(6)[:k]
        w[order] = np.arange(k, 0, -1, dtype=float)
        w /= w.sum()
    return w

def clipped_normal(rng, mean, sd, low, high):
    return float(np.clip(rng.normal(mean, sd), low, high))

def make_route(rng, base_distance):
    distance = float(np.clip(
        base_distance * rng.lognormal(mean=0.0, sigma=0.14),
        1800.0,
        13000.0
    ))

    speed_mps = clipped_normal(rng, 7.3, 1.5, 4.0, 12.0)
    congestion = clipped_normal(rng, 1.05, 0.12, 0.82, 1.38)
    time_s = distance / speed_mps * congestion

    intersection_rate = clipped_normal(rng, 1.20, 0.35, 0.35, 2.10)
    complex_intersection = int(np.clip(
        rng.poisson(intersection_rate * distance / 4200.0),
        0,
        8
    ))

    merge_ratio = float(np.clip(
        rng.beta(3.4, 6.1) + rng.normal(0.0, 0.025),
        0.02,
        0.68
    ))
    merge_branch_score_m = distance * merge_ratio

    narrow_ratio = float(np.clip(
        rng.beta(2.0, 11.2) + rng.normal(0.0, 0.018),
        0.005,
        0.50
    ))
    narrow_road_score_m = distance * narrow_ratio

    unfamiliar_turn = int(np.clip(
        rng.poisson(0.90 * distance / 4300.0),
        0,
        7
    ))

    consecutive_action = int(np.clip(
        rng.poisson(4.8 * distance / 4500.0),
        0,
        18
    ))

    if rng.random() < 0.17:
        child_100m_inside_m = 0.0
    else:
        child_ratio = float(np.clip(
            rng.normal(0.073, 0.043),
            0.005,
            0.19
        ))
        child_100m_inside_m = min(
            distance,
            distance * child_ratio
        )

    raw6 = [
        float(complex_intersection),
        float(merge_branch_score_m),
        float(narrow_road_score_m),
        float(unfamiliar_turn),
        float(consecutive_action),
        float(child_100m_inside_m)
    ]

    return {
        'time_s': float(time_s),
        'distance_m': float(distance),
        'raw_features': raw6
    }

def route_cost(route, weights):
    raw = np.asarray(route['raw_features'], dtype=float)
    norm = np.array([3.0, 1800.0, 900.0, 2.0, 6.0, 450.0], dtype=float)
    preference_cost = float(((raw / norm) * weights).sum())
    return (
        0.68 * route['time_s'] / 650.0
        + 0.32 * route['distance_m'] / 5000.0
        + 2.8 * preference_cost
    )


def generate_legacy_searches(n_searches, seed):
    """원본 RNG 호출 순서 그대로. Q4 추가가 후보/노이즈/split을 바꾸지 않는다."""
    rng = np.random.default_rng(seed)
    events = []
    for search_id in range(n_searches):
        weights = survey_weights(rng)
        base_distance = float(np.clip(
            rng.lognormal(mean=np.log(4300.0), sigma=0.38), 1800.0, 11500.0))
        routes = [make_route(rng, base_distance) for _ in range(3)]
        costs = np.array([route_cost(route, weights) for route in routes])
        noise = rng.gumbel(0.0, 0.34, size=3)
        events.append({"search_id": search_id, "weights": weights.tolist(),
                       "routes": routes, "choice_noise": noise.tolist(),
                       "chosen_legacy": int(np.argmin(costs + noise))})
    order = rng.permutation(n_searches)
    train_end, validation_end = n_searches * 70 // 100, n_searches * 85 // 100
    for split, indices in zip(SPLITS, (order[:train_end], order[train_end:validation_end], order[validation_end:])):
        for idx in indices:
            events[int(idx)]["split"] = split
    return events


def pair_indices(chosen, rng):
    """원본과 동일한 selected-vs-unselected 두 쌍, 쌍마다 한 방향만 선택."""
    for other in range(3):
        if other != chosen:
            yield (chosen, other) if rng.random() < 0.5 else (other, chosen)


def verify_legacy_replay(events, baseline, placement_seed):
    """기존 CSV를 변경하지 않고 원본 생성 규칙/분할/A-B/Y를 재현하는지 확인."""
    require(baseline.is_file(), f"BASELINE_MISSING: {baseline}")
    rng = np.random.default_rng(placement_seed)
    with baseline.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        require(reader.fieldnames == ["search_id", "split", "a", "b", "y", *FEATURES],
                "BASELINE_COLUMNS_MISMATCH")
        count = 0
        for event in events:
            for a, b in pair_indices(event["chosen_legacy"], rng):
                row = next(reader, None)
                require(row is not None, "BASELINE_TOO_SHORT")
                require((int(row["search_id"]), row["split"], int(row["a"]), int(row["b"]), int(row["y"])) ==
                        (event["search_id"], event["split"], a, b, int(a == event["chosen_legacy"])),
                        "BASELINE_ID_SPLIT_AB_Y_MISMATCH")
                ra, rb = event["routes"][a], event["routes"][b]
                x = [ra["time_s"] - rb["time_s"], ra["distance_m"] - rb["distance_m"]]
                x += [(u - v) * w for u, v, w in zip(ra["raw_features"], rb["raw_features"], event["weights"])]
                require(all(math.isclose(float(row[f]), v, rel_tol=1e-10, abs_tol=1e-9)
                            for f, v in zip(FEATURES, x)), "BASELINE_FEATURE_MISMATCH")
                count += 1
        require(next(reader, None) is None, "BASELINE_TOO_LONG")
    return {"status": "passed", "rows": count, "sha256": sha256(baseline)}


def load_bank(path):
    bank = json.loads(path.read_text(encoding="utf-8-sig"))
    require(set(bank["cases"]) == set(FACTORS), "Q4_BANK_FACTORS_MISMATCH")
    for questions in bank["cases"].values():
        require(len(questions) == 4, "Q4_BANK_REQUIRES_FOUR_QUESTIONS_PER_FACTOR")
        require(all(type(q.get("training_eligible")) is bool for q in questions),
                "Q4_BANK_ELIGIBILITY_MISSING")
    return bank


def simulated_q4_profile(weights, rng, bank, mode):
    # 분포/seed는 새 실험 가정이다. 기존 Q4 응답/시험 계수인 것처럼 기록하지 않는다.
    sampled = np.exp(rng.uniform(np.log(MULTIPLIER_MIN), np.log(MULTIPLIER_MAX), size=2))
    factor = FACTORS[int(np.argmax(weights))] if any(weights) else None
    if mode == "neutral":
        multipliers, status = [1.0, 1.0], "NEUTRAL_CONTROL"
    elif factor is None:
        multipliers, status = [1.0, 1.0], "HELD_NO_Q2_PRIORITY"
    elif not all(q["training_eligible"] for q in bank["cases"][factor]):
        multipliers, status = [1.0, 1.0], "HELD_BANK_INELIGIBLE"
    else:
        multipliers, status = sampled.tolist(), "SIMULATED_PROFILE"
    return {"m_time": multipliers[0], "m_distance": multipliers[1],
            "reference_factor": factor, "status": status,
            "source": "SYNTHETIC_PROFILE_NOT_Q4_RESPONSE_FIT"}


def displayed_cost(route, weights, m_time, m_distance):
    # 원본의 계수/비용 단위는 유지한다. 이것은 fitted scaler가 아닌 합성 정답 규칙이다.
    burden_norm = np.array([3.0, 1800.0, 900.0, 2.0, 6.0, 450.0])
    burden = float(((np.asarray(route["raw_features"]) / burden_norm) * weights).sum())
    return (0.68 * m_time * route["display_duration_s"] / 650.0
            + 0.32 * m_distance * route["distance_m"] / 5000.0 + 2.8 * burden)


def add_q4_profiles(events, bank, q4_seed, mode):
    rng = np.random.default_rng(q4_seed)
    for event in events:
        profile = simulated_q4_profile(event["weights"], rng, bank, mode)
        event["q4_profile"] = profile
        for route in event["routes"]:
            route["display_duration_s"] = float(math.floor(route["time_s"] / 60.0 + 0.5) * 60)
        weights = np.asarray(event["weights"], dtype=float)
        costs = [displayed_cost(r, weights, profile["m_time"], profile["m_distance"])
                 for r in event["routes"]]
        neutral = [displayed_cost(r, weights, 1.0, 1.0) for r in event["routes"]]
        event["chosen"] = int(np.argmin(np.array(costs) + event["choice_noise"]))
        event["chosen_without_q4_displayed"] = int(np.argmin(np.array(neutral) + event["choice_noise"]))
        event["source"] = "synthetic_q2_q4_profile_v1"
        event["feature_version"] = "static_burden_v5_child_circle_inside"


def make_pairs(events, placement_seed):
    rng = np.random.default_rng(placement_seed)
    rows, controls = [], []
    for event in events:
        profile = event["q4_profile"]
        for a, b in pair_indices(event["chosen"], rng):
            ra, rb = event["routes"][a], event["routes"][b]
            x = build_q2_q4_features(ra, rb, event["weights"], profile["m_time"], profile["m_distance"])
            x_base = build_q2_q4_features(ra, rb, event["weights"], 1.0, 1.0)
            common = {"search_id": event["search_id"], "split": event["split"],
                      "a": a, "b": b, "y": int(a == event["chosen"]),
                      "sample_weight": 0.5, "m_time": profile["m_time"], "m_distance": profile["m_distance"]}
            rows.append({**common, **dict(zip(FEATURES, x))})
            controls.append({**common, **dict(zip(FEATURES, x_base))})
    return rows, controls


def validate_dataset(events, rows, controls):
    """데이터 계약만 검증한다. 모델을 학습하거나 성능을 평가하지 않는다."""
    require(len(rows) == len(controls) == 2 * len(events), "PAIR_COUNT_MISMATCH")
    events_by_id = {e["search_id"]: e for e in events}
    require(len(events_by_id) == len(events), "DUPLICATE_SEARCH_ID")
    groups = defaultdict(list)
    for row, control in zip(rows, controls):
        event = events_by_id[row["search_id"]]
        groups[row["search_id"]].append(row)
        a, b, y = row["a"], row["b"], row["y"]
        require(a != b and a in range(3) and b in range(3) and y in (0, 1), "INVALID_PAIR")
        require((a if y else b) == event["chosen"], "CONTRADICTORY_CHOICE")
        require(row["split"] == event["split"], "SEARCH_SPLIT_LEAKAGE")
        for key in ("search_id", "split", "a", "b", "y", "sample_weight", "m_time", "m_distance"):
            require(row[key] == control[key], "CONTROL_COMPARISON_MISMATCH")
        require(row["sample_weight"] == 0.5, "INVALID_SAMPLE_WEIGHT")
        profile = event["q4_profile"]
        require((row["m_time"], row["m_distance"]) == (profile["m_time"], profile["m_distance"]),
                "SEARCH_MULTIPLIER_MISMATCH")
        ra, rb, w = event["routes"][a], event["routes"][b], event["weights"]
        expected = [row["m_time"] * (ra["display_duration_s"] - rb["display_duration_s"]),
                    row["m_distance"] * (ra["distance_m"] - rb["distance_m"])]
        expected += [(u - v) * weight for u, v, weight in zip(ra["raw_features"], rb["raw_features"], w)]
        x = [row[f] for f in FEATURES]
        require(len(x) == 8 and all(math.isfinite(v) for v in x), "INVALID_X8")
        require(all(math.isclose(u, v, rel_tol=1e-10, abs_tol=1e-9) for u, v in zip(x, expected)),
                "FEATURE_FORMULA_MISMATCH")
        base = [u - v for u, v in zip(candidate_vector(ra, w), candidate_vector(rb, w))]
        require([control[f] for f in FEATURES] == base, "CONTROL_BASE_MISMATCH")
        require(x[2:] == base[2:], "Q2_DOUBLE_APPLICATION")
        reverse = build_q2_q4_features(rb, ra, w, row["m_time"], row["m_distance"])
        require(reverse == [-v for v in x], "AB_SYMMETRY_MISMATCH")
    for search_id, pairs in groups.items():
        require(len(pairs) == 2, "REQUIRES_TWO_PAIRS_PER_SEARCH")
        require(len({tuple(sorted((r["a"], r["b"]))) for r in pairs}) == 2, "DUPLICATE_OR_REVERSED_PAIR")
        require(set(v for r in pairs for v in (r["a"], r["b"])) == {0, 1, 2}, "MISSING_CANDIDATE")
        require(sum(r["sample_weight"] for r in pairs) == 1.0, "SEARCH_WEIGHT_SUM_MISMATCH")
    search_counts = {s: sum(e["split"] == s for e in events) for s in SPLITS}
    pair_counts = {s: sum(r["split"] == s for r in rows) for s in SPLITS}
    require(list(search_counts.values()) == [len(events) * 70 // 100, len(events) * 15 // 100, len(events) * 15 // 100],
            "SPLIT_RATIO_MISMATCH")
    require(all(pair_counts[s] == 2 * search_counts[s] for s in SPLITS), "SPLIT_PAIR_COUNT_MISMATCH")
    return {"status": "passed", "search_count": len(events), "pair_row_count": len(rows),
            "split_search_counts": search_counts, "split_pair_counts": pair_counts,
            "checks": ["X8 formula/order/finite", "Q2 once", "Q4 per search", "AB sign reversal",
                       "selected vs unselected only", "no reverse duplicates", "weight sum 1 per search",
                       "search-disjoint 70:15:15", "matched Q2-only control"]}


def csv_bytes(rows):
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8-sig")


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def save_outputs(output, files):
    # 기존 파일은 값이 다르면 거부한다. 같은 seed/코드로 재실행한 동일 파일만 재사용한다.
    for name, content in files.items():
        path = output / name
        if path.exists():
            require(path.is_file() and path.read_bytes() == content,
                    f"OUTPUT_EXISTS: {path}\n기존 파일은 보존합니다. --output으로 새 폴더를 지정하세요.")
    output.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        path = output / name
        if not path.exists():
            with path.open("xb") as stream:
                stream.write(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--searches", type=int, default=3000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--placement-seed", type=int, default=2026)
    parser.add_argument("--q4-seed", type=int, default=20260917)
    parser.add_argument("--q4-mode", choices=("simulated", "neutral"), default="simulated")
    parser.add_argument("--output", type=Path, default=ROOT / "ml/data/q2_q4")
    args = parser.parse_args()
    require(args.searches >= 20 and args.searches % 20 == 0, "SEARCHES_MUST_BE_A_POSITIVE_MULTIPLE_OF_20")
    require(min(args.seed, args.placement_seed, args.q4_seed) >= 0, "SEEDS_MUST_BE_NONNEGATIVE")
    require(len(FEATURES) == 8 and [MULTIPLIER_MIN, MULTIPLIER_MAX] == [0.5, 2.0], "FEATURE_OR_Q4_CONTRACT_MISMATCH")
    bank_path = ROOT / "apps/backend/src/config/q4Cases.json"
    bank = load_bank(bank_path)
    events = generate_legacy_searches(args.searches, args.seed)
    if (args.searches, args.seed, args.placement_seed) == (3000, 42, 2026):
        replay = verify_legacy_replay(events, ROOT / "ml/data/synthetic_pairwise.csv", args.placement_seed)
    else:
        replay = {"status": "not_applicable", "reason": "custom search count or legacy seeds"}
    add_q4_profiles(events, bank, args.q4_seed, args.q4_mode)
    rows, controls = make_pairs(events, args.placement_seed)
    validation = validate_dataset(events, rows, controls)
    changes_q4 = sum(e["chosen"] != e["chosen_without_q4_displayed"] for e in events)
    changes_time = sum(e["chosen_without_q4_displayed"] != e["chosen_legacy"] for e in events)
    files = {"synthetic_pairwise_q2_q4.csv": csv_bytes(rows),
             "synthetic_pairwise_q2_control.csv": csv_bytes(controls),
             "synthetic_searches_q2_q4.json": json_bytes(events)}
    metadata = {
        "purpose": "synthetic_q2_q4_common_model_comparison", "training_source": "SYNTHETIC_Q2_Q4_PROFILE",
        "real_user_validated": False, "model_not_run": True, "scaler_fitted": False,
        "search_count": len(events), "pair_row_count": len(rows),
        "candidate_count_per_search": 3, "pair_rows_per_search": 2,
        "split_search_counts": validation["split_search_counts"], "split_pair_counts": validation["split_pair_counts"],
        "generation_seed": args.seed, "placement_seed": args.placement_seed, "q4_seed": args.q4_seed,
        "feature_names": FEATURES, "factor_order": FACTORS, "raw6_units": UNITS,
        "feature_version": "static_burden_v5_child_circle_inside", "contract_version": "anjeon_contract_v6_child100",
        "csv_audit_columns_not_model_features": ["sample_weight", "m_time", "m_distance"],
        "time_policy": "display_duration_s=floor(legacy_time_s/60+0.5)*60; matches service UI",
        "original_baseline_replay": replay,
        "original_generator": {"name": "generate_synthetic_child100_final_data.py", "sha256": ORIGINAL_GENERATOR_SHA256,
                               "preserved": ["route distributions", "Q2 distribution", "noise draws", "split RNG", "placement RNG"]},
        "label_policy": {"cost": "0.68*m_time*display_duration_s/650 + 0.32*m_distance*distance_m/5000 + 2.8*sum(Q2*raw6/norm)",
                         "burden_norm": [3, 1800, 900, 2, 6, 450], "noise": "original Gumbel(0,0.34) draws per candidate",
                         "selection": "argmin(cost+noise)", "y": "1 iff displayed A is chosen",
                         "cost_reference_units_are_not_fitted_scaler": True},
        "q4_profile": {"mode": args.q4_mode, "distribution_assumption": "independent LogUniform(0.5,2) for each multiplier",
                       "bounds": [0.5, 2.0], "not_fit_from_q4_answers": True,
                       "fallback": "[1,1] for no Q2 priority or ineligible bank factor",
                       "status_counts": dict(Counter(e["q4_profile"]["status"] for e in events)),
                       "bank_version": bank["case_set_version"], "bank_sha256": sha256(bank_path),
                       "trial_policy_reference_only_not_executed": {"regularization": 1, "minimumAnswers": 3, "minimumDesignRatio": 0.01}},
        "pair_policy": "chosen vs each unchosen; random A/B; no reverse augmentation",
        "sample_weight_policy": "1 / pairs_per_search = 0.5",
        "q2_control": "same NEW chosen/Y, candidates, split, A/B and sample weights; Q4 omitted from X only; audit m columns still describe the synthetic profile",
        "choice_changes_due_to_q4_with_displayed_time": changes_q4,
        "choice_changes_due_to_time_rounding_without_q4": changes_time,
        "comparison_limit": "Old published metrics vs new metrics also differ in labels/pairs and displayed time. Use matched control for Q4 input ablation.",
        "validation": validation,
        "versions": {"python": sys.version.split()[0], "numpy": np.__version__},
        "code_sha256": {p.name: sha256(p) for p in [Path(__file__), Path(__file__).with_name("q2_q4_features.py"),
                                                    Path(__file__).with_name("features.py"), Path(__file__).with_name("inference.py")]},
        "output_sha256": {name: hashlib.sha256(content).hexdigest() for name, content in files.items()},
        "warning": "Synthetic profiles and choices, not real Q4 responses. Input and labels share an assumed cost rule; no real-user efficacy claim.",
    }
    files["metadata.json"] = json_bytes(metadata)
    save_outputs(args.output.resolve(), files)
    print(f"PASS: data validation / searches={len(events):,} / pair rows={len(rows):,}")
    for split in SPLITS:
        print(f"{split}: {validation['split_search_counts'][split]:,} searches / {validation['split_pair_counts'][split]:,} rows")
    print("Legacy baseline replay:", replay["status"])
    print("Q4 profile status:", metadata["q4_profile"]["status_counts"])
    print("Q4 changed choices:", changes_q4)
    print("Time rounding changed neutral choices:", changes_time)
    print("Output:", args.output.resolve())
    print("Synthetic profile simulation only. No scaler fit, training or model evaluation.")


if __name__ == "__main__":
    main()
