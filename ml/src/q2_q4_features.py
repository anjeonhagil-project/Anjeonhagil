"""후보 A/B + Q2 weights + Q4 배율 -> 스케일링 전 최종 X8.

프로젝트 루트에서 검증: python -B ml/src/q2_q4_features.py
기존 features.py를 재사용하며 q4_features.py는 필요하지 않다.
"""
from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from numbers import Real
from typing import Any

from features import FEATURES, candidate_vector

# ml/q4-trial.mjs의 POLICY.bounds. 배율 추정과 fallback 결정은 앞 단계에서 한다.
MULTIPLIER_MIN = 0.5
MULTIPLIER_MAX = 2.0


def _validate_multiplier(value: float, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError(f"INVALID_{name}: 실수 한 개가 필요합니다.")
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError) as error:
        raise ValueError(f"INVALID_{name}: 유한한 실수가 필요합니다.") from error
    if not math.isfinite(number):
        raise ValueError(f"INVALID_{name}: NaN/inf는 사용할 수 없습니다.")
    if not MULTIPLIER_MIN <= number <= MULTIPLIER_MAX:
        raise ValueError(f"INVALID_{name}: 허용 범위는 [0.5, 2.0]입니다.")
    return number


def build_q2_q4_features(
    candidate_a: Mapping[str, Any],
    candidate_b: Mapping[str, Any],
    q2_weights: Sequence[float],
    m_time: float,
    m_distance: float,
) -> list[float]:
    """기존 Q2 계산을 재사용하여 Q2+Q4 최종 X8을 새 리스트로 반환한다.

    후보 필수 키: display_duration_s(초), distance_m(m), raw_features(부담 6개).
    후보 값과 Q2는 candidate_vector의 기존 검증 규칙을 그대로 따른다.
    Q4 배율은 앞 단계에서 계산한 숫자이며 [0.5, 2.0] 범위만 허용한다.
    입력 후보/weights를 변경하지 않고 전달된 A-B 순서를 유지한다.
    배율 추정, scaling, split, Y 생성, 학습, 파일 저장은 하지 않는다.
    """
    if len(FEATURES) != 8 or list(FEATURES[:2]) != ["time_diff", "distance_diff"]:
        raise ValueError("Q2_Q4_FEATURE_ORDER_MISMATCH")
    if not isinstance(candidate_a, Mapping) or not isinstance(candidate_b, Mapping):
        raise ValueError("INVALID_CANDIDATE: 후보 A/B는 dict 형식이어야 합니다.")
    time_multiplier = _validate_multiplier(m_time, "M_TIME")
    distance_multiplier = _validate_multiplier(m_distance, "M_DISTANCE")

    # 기존 함수가 각 후보의 부담 6개에 Q2를 한 번씩 적용하고 입력도 검증한다.
    try:
        vector_a = candidate_vector(candidate_a, q2_weights)
        vector_b = candidate_vector(candidate_b, q2_weights)
    except (KeyError, TypeError, OverflowError) as error:
        raise ValueError("INVALID_Q2_INPUT: 후보 필수 키와 Q2 입력 형식을 확인하세요.") from error

    if len(vector_a) != len(FEATURES) or len(vector_b) != len(FEATURES):
        raise ValueError("INVALID_X8_LENGTH")
    X_final = [float(a - b) for a, b in zip(vector_a, vector_b)]

    # Q2 적용 완료 X_base의 시간·거리 두 값에만 Q4를 적용한다.
    X_final[0] *= time_multiplier
    X_final[1] *= distance_multiplier
    if len(X_final) != 8 or not all(math.isfinite(v) for v in X_final):
        raise ValueError("INVALID_FINAL_X8: 길이 8의 유한한 실수 벡터가 필요합니다.")
    return X_final


def _self_test() -> None:
    """기존 scripts/test-*.py와 같은 assert 기반 검증. 학습/파일 저장 없음."""
    from copy import deepcopy

    a = {"display_duration_s": 720.0, "distance_m": 1500.0,
         "raw_features": [2.4, 0.0, 4.4, 0.0, 0.0, 41.6]}
    b = {"display_duration_s": 600.0, "distance_m": 1000.0,
         "raw_features": [0.0, 1.6, 0.0, 0.0, 3.2, 0.0]}
    weights = [0.125, 0.125, 0.25, 0.25, 0.125, 0.125]
    original = deepcopy((a, b, weights))
    base = [u - v for u, v in zip(candidate_vector(a, weights), candidate_vector(b, weights))]
    expected = [180.0, 400.0, 0.3, -0.2, 1.1, 0.0, -0.4, 5.2]
    passed = 0

    def check(condition):
        nonlocal passed
        assert condition
        passed += 1

    def rejected(ca, cb, w, mt, md, code):
        try:
            build_q2_q4_features(ca, cb, w, mt, md)
        except ValueError as error:
            check(code in str(error))
        else:
            raise AssertionError(f"잘못된 입력을 허용했습니다: {code}")

    output = build_q2_q4_features(a, b, weights, 1.5, 0.8)
    check(build_q2_q4_features(a, b, weights, 1, 1) == base)
    check(output == expected)
    check(output[2:] == base[2:])
    check(output[2:] != [v * w for v, w in zip(base[2:], weights)])
    check((a, b, weights) == original)
    check(build_q2_q4_features(b, a, weights, 1.5, 0.8) == [-v for v in output])
    check(build_q2_q4_features(a, a, weights, 1.5, 0.8) == [0.0] * 8)
    check(build_q2_q4_features(a, b, [0.0] * 6, 1.5, 0.8) == [180.0, 400.0] + [0.0] * 6)
    check(build_q2_q4_features(a, b, weights, 0.5, 2.0)[:2] == [60.0, 1000.0])
    check(len(output) == len(FEATURES) == 8)
    # 부담 6개에 서로 다른 값을 넣어 순서와 Q2 적용 위치를 확인한다.
    ordered_a = dict(a, raw_features=[8, 16, 12, 16, 40, 48])
    ordered_b = dict(b, raw_features=[0] * 6)
    check(build_q2_q4_features(ordered_a, ordered_b, weights, 1, 1)[2:] == [1, 2, 3, 4, 5, 6])

    for invalid in (3, 0.49, -1, math.nan, math.inf, -math.inf, None, True, "1.5", [1], 1 + 2j):
        rejected(a, b, weights, invalid, 1, "INVALID_M_TIME")
        rejected(a, b, weights, 1, invalid, "INVALID_M_DISTANCE")
    for invalid in ([1] * 5, [1] * 7, [-1, 2, 0, 0, 0, 0], [math.nan] * 6, [math.inf] * 6):
        rejected(a, b, invalid, 1, 1, "INVALID_WEIGHTS")
    rejected(a, b, [0.1] * 6, 1, 1, "INVALID_WEIGHT_SUM")
    rejected(a, b, None, 1, 1, "INVALID_Q2_INPUT")
    rejected({}, b, weights, 1, 1, "INVALID_Q2_INPUT")
    rejected(None, b, weights, 1, 1, "INVALID_CANDIDATE")
    rejected(dict(a, raw_features=[0] * 5), b, weights, 1, 1, "INVALID_RAW6")
    for invalid in (None, math.nan, math.inf, -1, True):
        rejected(dict(a, display_duration_s=invalid), b, weights, 1, 1, "INVALID_FEATURE_VALUE")
    huge = dict(a, display_duration_s=float.fromhex("0x1.fffffffffffffp+1023"))
    rejected(huge, b, weights, 2, 1, "INVALID_FINAL_X8")

    print(f"PASS: {passed} checks (Q2 + Q4 feature generation only)")
    print("X_base  =", base)
    print("X_final =", output)


if __name__ == "__main__":
    _self_test()
