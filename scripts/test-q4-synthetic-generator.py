"""Git 공통 데이터에서 Q4 fitted 실험만 파생되는지 통합 검증한다.

잡아내려는 회귀: 파생 생성기가 검색/Y/split/A-B/Q2 feature를 다시 만들거나
원본 파일을 변경하고, Q4 fitted X0/X1 이외의 비교 조건까지 바꾸는 문제.
"""
from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
PYTHON = Path(sys.executable)
BASE_GENERATOR = ROOT / "ml/src/generate_synthetic_q2_q4.py"
FITTED_GENERATOR = ROOT / "ml/src/generate_synthetic_q2_q4_fitted.py"
IDENTITY_COLUMNS = ["search_id", "split", "a", "b", "y", "sample_weight"]
Q2_FEATURES = [
    "intersection_weighted_diff", "merge_weighted_diff", "narrow_weighted_diff",
    "turn_weighted_diff", "consecutive_weighted_diff", "child_100m_weighted_diff",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


temporary = ROOT / ".test-tools" / "q4-fitted-derivation-test"
source = temporary / "source"
output = temporary / "output"
subprocess.run(
    [str(PYTHON), "-B", "-X", "utf8", str(BASE_GENERATOR),
     "--searches", "20", "--output", str(source)],
    cwd=ROOT, check=True,
)
source_hashes = {path.name: sha256(path) for path in source.iterdir() if path.is_file()}

subprocess.run(
    [str(PYTHON), "-B", "-X", "utf8", str(FITTED_GENERATOR),
     "--source", str(source), "--q4-response-seed", "20260918",
     "--output", str(output)],
    cwd=ROOT, check=True,
)

assert source_hashes == {
    path.name: sha256(path) for path in source.iterdir() if path.is_file()
}, "추가 실험은 Git 공통 원본 파일을 변경하면 안 된다"

source_rows = read_csv(source / "synthetic_pairwise_q2_q4.csv")
fitted_rows = read_csv(output / "synthetic_pairwise_q2_q4.csv")
assert len(source_rows) == len(fitted_rows) == 40
assert all(
    all(before[column] == after[column] for column in IDENTITY_COLUMNS + Q2_FEATURES)
    for before, after in zip(source_rows, fitted_rows)
), "Y/split/A-B/sample weight/X2~X7은 공통 데이터와 완전히 같아야 한다"
assert any(
    before["time_diff"] != after["time_diff"]
    or before["distance_diff"] != after["distance_diff"]
    for before, after in zip(source_rows, fitted_rows)
), "추가 실험에서는 fitted multiplier에 따라 X0/X1이 달라지는 행이 있어야 한다"

source_searches = json.loads(
    (source / "synthetic_searches_q2_q4.json").read_text(encoding="utf-8")
)
fitted_searches = json.loads(
    (output / "synthetic_searches_q2_q4.json").read_text(encoding="utf-8")
)
for before, after in zip(source_searches, fitted_searches):
    for key in ("search_id", "split", "weights", "routes", "chosen", "choice_noise"):
        assert before[key] == after[key], f"기존 검색 필드 {key}를 다시 만들면 안 된다"
    assert after["q4_source_profile"] == before["q4_profile"]
    assert len(after["q4_responses"]) == 4
    assert all(response["answer"] in ("A", "B") for response in after["q4_responses"])
    assert after["q4_profile"]["source"] == "SYNTHETIC_Q4_RESPONSES_FIT"

metadata = json.loads((output / "metadata.json").read_text(encoding="utf-8"))
assert metadata["purpose"] == "q4_fitted_multiplier_additional_experiment"
assert metadata["source_dataset"]["output_sha256"] == source_hashes
assert metadata["preserved_from_source"] == [
    "search_id", "split", "routes", "q2_weights", "a_b_placement",
    "y", "sample_weight", "x2_to_x7",
]
assert metadata["changed_from_source"] == [
    "q4_responses", "m_time", "m_distance", "x0_time_diff", "x1_distance_diff"
]
assert metadata["q4_profile"]["fit_from_synthetic_q4_answers"] is True
assert metadata["q4_profile"]["trial_policy_executed"]["regularization"] == 1
assert metadata["q4_response_seed"] == 20260918
assert metadata["validation"]["source_comparison"] == "passed"
for dependency in (
    "generate_synthetic_q2_q4_fitted.py", "q4-trial.mjs",
    "q4-synthetic-profiles.mjs", "synthesize-q4-profiles.mjs",
):
    assert dependency in metadata["code_sha256"], f"재현성 메타데이터에 {dependency} 해시가 필요하다"

fitted_count = sum(
    event["q4_profile"]["status"] == "TRIAL_ONLY" for event in fitted_searches
)
assert fitted_count > 0

print(f"PASS: Git common data preserved; 20 searches, 80 Q4 answers, {fitted_count} fitted profiles")
