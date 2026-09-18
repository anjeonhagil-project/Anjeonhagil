# Q2+Q4 Logistic 실험 결과

- 실행일: 2026-09-18
- 실행 브랜치: `feature/model-xgboost`
- 대상 모델: Pairwise Logistic Regression
- 목적: Logistic과 XGBoost가 동일한 Q2+Q4 합성 데이터와 평가 조건을 사용하도록 고정한 뒤, Logistic 결과를 먼저 산출한다.

> 최신 결과는 아래 `Q4 4응답 자동 계산 재실행`이다. 이후 1~11절은 비교를 위해 보존한 최초 `multiplier 직접 시뮬레이션` 실행 기록이다.

## Q4 4응답 자동 계산 재실행

Git 공통 데이터 `ml/data/q2_q4/`의 simulated multiplier를 숨은 성향으로 사용해 `q4Cases.json` 문항 4개의 A/B 응답을 합성했다. 서비스와 같은 `fitTrial()`로 `m_time`, `m_distance`를 다시 추정하고, 공통 데이터의 Y와 비교 조건을 보존한 채 Logistic을 다시 학습했다.

팀 공통 원본 `ml/src/generate_synthetic_q2_q4.py`는 수정하지 않았다. Q4 응답 생성·추정 실험은 별도 파일 `ml/src/generate_synthetic_q2_q4_fitted.py`로 분리했다.

```powershell
.venv\Scripts\python.exe -B -X utf8 ml/src/generate_synthetic_q2_q4_fitted.py --source ml/data/q2_q4 --q4-response-seed 20260918 --output ml/data/q2_q4_fitted
.venv\Scripts\python.exe -B -X utf8 ml/src/logistic_model.py --data ml/data/q2_q4_fitted/synthetic_pairwise_q2_q4.csv --metadata ml/data/q2_q4_fitted/metadata.json --output ml/artifacts/logistic_q2_q4_fitted
```

```text
Git 공통 데이터의 simulated m_time/m_distance
→ 고정 seed 기반 Q4 A/B 응답 4개
→ fitTrial(lambda=1, minimumAnswers=3, minimumDesignRatio=0.01)
→ 추정 m_time, m_distance
→ 기존 Y/split/A·B/sample weight/X2~X7 보존
→ X0/X1만 fitted multiplier로 다시 계산
→ Logistic 재학습
```

추가 실험 파생 데이터:

```text
ml/data/q2_q4_fitted/synthetic_pairwise_q2_q4.csv
```

생성 결과:

| 항목 | 결과 |
|---|---:|
| 전체 searches | 3,000 |
| 전체 Q4 합성 응답 | 12,000 |
| `fitTrial()` 계산 성공 | 2,127 profiles |
| 정책상 `[1,1]` fallback | 873 profiles |
| Train / Validation / Test rows | 4,200 / 900 / 900 |
| 원본과 Y가 동일한 pair | 6,000 / 6,000 |
| fitted 값으로 X0/X1이 달라진 pair | 4,250 |

873개 fallback은 Q2 우선순위가 없거나 현재 문항 은행에서 학습 제외된 요인에 해당한다. 모든 합성 사용자는 A/B 응답 4개를 생성했으며 `UNSURE`는 생성하지 않았다.

새 Logistic 선택 설정:

```json
{
  "C": 100,
  "penalty": "l1",
  "solver": "liblinear",
  "class_weight": null,
  "max_iter": 1000,
  "fit_intercept": false
}
```

새 평가 결과:

| 지표 | Validation | Test |
|---|---:|---:|
| Pair Accuracy | 86.44% | 88.33% |
| ROC-AUC | 0.94904 | 0.95647 |
| Log Loss | 0.28463 | 0.27118 |
| Search Top-1 | 76.22% | 79.56% |

새 산출물:

```text
ml/artifacts/logistic_q2_q4_fitted/
```

60개 조합의 전체 정밀 결과는 `ml/artifacts/logistic_q2_q4_fitted/validation_grid.csv`에 저장했다. 이 산출물 폴더는 `.gitignore` 대상이다.

이번 재실행은 검색이나 Y를 새로 생성하지 않았다. Git 공통 데이터의 simulated multiplier는 Q4 응답 생성에만 숨은 성향으로 사용했고, Logistic 입력 X0/X1에는 네 응답에서 `fitTrial()`이 추정한 multiplier만 사용했다. 따라서 메인 공정 비교 데이터와 추가 실험의 차이는 Q4 응답 추정으로 바뀐 multiplier와 X0/X1에 한정된다. 최고 설정은 Train에서 학습하고 Validation에서 선택한 뒤, Train+Validation 5,100행(85%)으로 최종 모델과 scaler를 다시 학습하고 Test 900행(15%)에서 마지막 평가했다.

## 1. 실험 범위

이번 실행에서는 새 Q2+Q4 합성 데이터로 Logistic 모델만 학습·검증·평가했다.

최종 비교 대상 네 가지 중 이번 문서가 다루는 범위는 **새 Q2+Q4 Logistic**이다.

1. 기존 Q2-only Logistic — 기존 baseline
2. 기존 Q2-only XGBoost — 기존 baseline
3. **새 Q2+Q4 Logistic — 이번 실행 완료**
4. 새 Q2+Q4 XGBoost — 팀원 실행 대상

## 2. 사용 데이터

입력 파일:

```text
ml/data/q2_q4/synthetic_pairwise_q2_q4.csv
```

데이터 구성:

| 항목 | 값 |
|---|---:|
| 전체 search 수 | 3,000 |
| 전체 pair row 수 | 6,000 |
| 검색당 후보 수 | 3 |
| 검색당 pair 수 | 2 |
| Train | 2,100 searches / 4,200 rows |
| Validation | 450 searches / 900 rows |
| Test | 450 searches / 900 rows |

Split은 `search_id` 단위로 70:15:15 비율로 고정되어 있다. 동일한 `search_id`의 두 pair는 항상 같은 split에 포함된다.

### 데이터 무결성

저장된 데이터 파일 세 개의 SHA-256 해시가 `metadata.json`에 기록된 값과 모두 일치했다.

- `synthetic_pairwise_q2_q4.csv`
- `synthetic_pairwise_q2_control.csv`
- `synthetic_searches_q2_q4.json`

## 3. Feature 및 Q2/Q4 적용

모델 입력은 기존과 동일한 X8을 사용한다.

```text
X0 = time_diff × m_time
X1 = distance_diff × m_distance
X2~X7 = Q2 가중 부담 차이 6개
```

수식으로 표현하면 다음과 같다.

```python
X_q4 = [
    m_time * X_base[0],
    m_distance * X_base[1],
    *X_base[2:8],
]
```

- X2~X7에는 데이터 생성 단계에서 Q2 가중치가 이미 한 번 적용되어 있다.
- Logistic 학습 단계에서는 Q2를 다시 곱하지 않는다.
- Q4 때문에 feature 개수를 추가하지 않는다.
- A/B가 반전되면 `X -> -X`, `Y -> 1-Y` 관계를 유지한다.
- `X`와 `-X`를 모두 학습 데이터로 추가하는 reverse augmentation은 사용하지 않는다.

Q2+Q4 feature 자체 테스트는 총 49개 검사를 통과했다.

## 4. Sample weight와 Scaling

각 row의 sample weight는 다음 규칙을 사용한다.

```text
sample_weight = 1 / 같은 search_id의 pair 수
```

현재 검색당 pair가 두 개이므로 각 row의 weight는 `0.5`다.

Scaling 조건:

- 하이퍼파라미터 탐색에서는 Q4가 적용된 Train X로 `StandardScaler(with_mean=False)`를 fit하고 Validation에 적용한다.
- 최고 설정 선택 후 Train+Validation X로 최종 scaler와 모델을 새로 fit한다.
- Test에는 이 Train+Validation 기준 최종 scaler만 적용한다.
- 기존 Q2-only scaler는 재사용하지 않는다.
- 저장된 최종 scaler의 학습 표본 수는 Train+Validation row 수와 같은 5,100개로 확인했다.

## 5. 학습 및 모델 선택

실행 명령:

```powershell
.venv\Scripts\python.exe -B -X utf8 ml/src/logistic_model.py `
  --data ml/data/q2_q4/synthetic_pairwise_q2_q4.csv `
  --metadata ml/data/q2_q4/metadata.json `
  --output ml/artifacts/logistic_q2_q4
```

총 60개의 유효한 하이퍼파라미터 조합을 Validation에서 비교했다. 수렴 실패로 제외된 조합은 없다.

모델 선택 우선순위:

1. Validation Log Loss가 낮은 모델
2. Log Loss가 같으면 Validation Search Top-1이 높은 모델
3. 이후 작은 C, 작은 `max_iter` 순

선택된 설정:

```json
{
  "C": 100,
  "penalty": "l1",
  "solver": "liblinear",
  "class_weight": "balanced",
  "max_iter": 1000,
  "fit_intercept": false
}
```

### 60개 하이퍼파라미터 탐색 결과

아래 표는 `validation_grid.csv`의 60개 결과를 모델 선택 기준과 같은 순서로 정렬한 것이다. 지표는 가독성을 위해 소수점 다섯 자리로 표시했으며 원본 정밀 값은 `ml/artifacts/logistic_q2_q4/validation_grid.csv`에 보존되어 있다.

| 순위 | C | Penalty | Solver | Class weight | Max iter | Accuracy | ROC-AUC | Log Loss | Search Top-1 |
|---:|---:|---|---|---|---:|---:|---:|---:|---:|
| **1** | 100.0 | l1 | liblinear | balanced | 1000 | 0.86556 | 0.94912 | 0.28397 | 0.77111 |
| 2 | 100.0 | l1 | liblinear | balanced | 3000 | 0.86556 | 0.94912 | 0.28397 | 0.77111 |
| 3 | 100.0 | l2 | lbfgs | balanced | 1000 | 0.86556 | 0.94912 | 0.28397 | 0.77111 |
| 4 | 100.0 | l2 | lbfgs | balanced | 3000 | 0.86556 | 0.94912 | 0.28397 | 0.77111 |
| 5 | 100.0 | l2 | liblinear | balanced | 1000 | 0.86556 | 0.94912 | 0.28397 | 0.77111 |
| 6 | 100.0 | l2 | liblinear | balanced | 3000 | 0.86556 | 0.94912 | 0.28397 | 0.77111 |
| 7 | 100.0 | l1 | liblinear | None | 1000 | 0.86556 | 0.94905 | 0.28397 | 0.77111 |
| 8 | 100.0 | l1 | liblinear | None | 3000 | 0.86556 | 0.94905 | 0.28397 | 0.77111 |
| 9 | 100.0 | l2 | lbfgs | None | 1000 | 0.86556 | 0.94906 | 0.28398 | 0.77111 |
| 10 | 100.0 | l2 | lbfgs | None | 3000 | 0.86556 | 0.94906 | 0.28398 | 0.77111 |
| 11 | 100.0 | l2 | liblinear | None | 1000 | 0.86556 | 0.94906 | 0.28398 | 0.77111 |
| 12 | 100.0 | l2 | liblinear | None | 3000 | 0.86556 | 0.94906 | 0.28398 | 0.77111 |
| 13 | 10.0 | l1 | liblinear | balanced | 1000 | 0.86556 | 0.94910 | 0.28402 | 0.77111 |
| 14 | 10.0 | l1 | liblinear | balanced | 3000 | 0.86556 | 0.94910 | 0.28402 | 0.77111 |
| 15 | 10.0 | l1 | liblinear | None | 1000 | 0.86556 | 0.94904 | 0.28403 | 0.77111 |
| 16 | 10.0 | l1 | liblinear | None | 3000 | 0.86556 | 0.94904 | 0.28403 | 0.77111 |
| 17 | 10.0 | l2 | lbfgs | balanced | 1000 | 0.86556 | 0.94912 | 0.28404 | 0.77111 |
| 18 | 10.0 | l2 | lbfgs | balanced | 3000 | 0.86556 | 0.94912 | 0.28404 | 0.77111 |
| 19 | 10.0 | l2 | liblinear | balanced | 1000 | 0.86556 | 0.94912 | 0.28404 | 0.77111 |
| 20 | 10.0 | l2 | liblinear | balanced | 3000 | 0.86556 | 0.94912 | 0.28404 | 0.77111 |
| 21 | 10.0 | l2 | lbfgs | None | 1000 | 0.86556 | 0.94904 | 0.28405 | 0.77111 |
| 22 | 10.0 | l2 | lbfgs | None | 3000 | 0.86556 | 0.94904 | 0.28405 | 0.77111 |
| 23 | 10.0 | l2 | liblinear | None | 1000 | 0.86556 | 0.94904 | 0.28405 | 0.77111 |
| 24 | 10.0 | l2 | liblinear | None | 3000 | 0.86556 | 0.94904 | 0.28405 | 0.77111 |
| 25 | 1.0 | l1 | liblinear | balanced | 1000 | 0.86556 | 0.94906 | 0.28456 | 0.77111 |
| 26 | 1.0 | l1 | liblinear | balanced | 3000 | 0.86556 | 0.94906 | 0.28456 | 0.77111 |
| 27 | 1.0 | l1 | liblinear | None | 1000 | 0.86556 | 0.94904 | 0.28457 | 0.77111 |
| 28 | 1.0 | l1 | liblinear | None | 3000 | 0.86556 | 0.94904 | 0.28457 | 0.77111 |
| 29 | 1.0 | l2 | liblinear | balanced | 1000 | 0.86556 | 0.94905 | 0.28480 | 0.77111 |
| 30 | 1.0 | l2 | liblinear | balanced | 3000 | 0.86556 | 0.94905 | 0.28480 | 0.77111 |
| 31 | 1.0 | l2 | lbfgs | balanced | 1000 | 0.86556 | 0.94905 | 0.28480 | 0.77111 |
| 32 | 1.0 | l2 | lbfgs | balanced | 3000 | 0.86556 | 0.94905 | 0.28480 | 0.77111 |
| 33 | 1.0 | l2 | liblinear | None | 1000 | 0.86556 | 0.94903 | 0.28481 | 0.77111 |
| 34 | 1.0 | l2 | liblinear | None | 3000 | 0.86556 | 0.94903 | 0.28481 | 0.77111 |
| 35 | 1.0 | l2 | lbfgs | None | 1000 | 0.86556 | 0.94903 | 0.28481 | 0.77111 |
| 36 | 1.0 | l2 | lbfgs | None | 3000 | 0.86556 | 0.94903 | 0.28481 | 0.77111 |
| 37 | 0.1 | l1 | liblinear | balanced | 1000 | 0.86444 | 0.94870 | 0.29301 | 0.76889 |
| 38 | 0.1 | l1 | liblinear | balanced | 3000 | 0.86444 | 0.94870 | 0.29301 | 0.76889 |
| 39 | 0.1 | l1 | liblinear | None | 1000 | 0.86444 | 0.94868 | 0.29303 | 0.76889 |
| 40 | 0.1 | l1 | liblinear | None | 3000 | 0.86444 | 0.94868 | 0.29303 | 0.76889 |
| 41 | 0.1 | l2 | lbfgs | balanced | 1000 | 0.86333 | 0.94877 | 0.29454 | 0.76889 |
| 42 | 0.1 | l2 | lbfgs | balanced | 3000 | 0.86333 | 0.94877 | 0.29454 | 0.76889 |
| 43 | 0.1 | l2 | liblinear | balanced | 1000 | 0.86333 | 0.94877 | 0.29454 | 0.76889 |
| 44 | 0.1 | l2 | liblinear | balanced | 3000 | 0.86333 | 0.94877 | 0.29454 | 0.76889 |
| 45 | 0.1 | l2 | lbfgs | None | 1000 | 0.86333 | 0.94875 | 0.29455 | 0.76889 |
| 46 | 0.1 | l2 | lbfgs | None | 3000 | 0.86333 | 0.94875 | 0.29455 | 0.76889 |
| 47 | 0.1 | l2 | liblinear | None | 1000 | 0.86333 | 0.94875 | 0.29455 | 0.76889 |
| 48 | 0.1 | l2 | liblinear | None | 3000 | 0.86333 | 0.94875 | 0.29455 | 0.76889 |
| 49 | 0.01 | l2 | lbfgs | balanced | 1000 | 0.86222 | 0.94532 | 0.36264 | 0.76889 |
| 50 | 0.01 | l2 | lbfgs | balanced | 3000 | 0.86222 | 0.94532 | 0.36264 | 0.76889 |
| 51 | 0.01 | l2 | liblinear | balanced | 1000 | 0.86222 | 0.94532 | 0.36264 | 0.76889 |
| 52 | 0.01 | l2 | liblinear | balanced | 3000 | 0.86222 | 0.94532 | 0.36264 | 0.76889 |
| 53 | 0.01 | l2 | lbfgs | None | 1000 | 0.86222 | 0.94531 | 0.36265 | 0.76889 |
| 54 | 0.01 | l2 | lbfgs | None | 3000 | 0.86222 | 0.94531 | 0.36265 | 0.76889 |
| 55 | 0.01 | l2 | liblinear | None | 1000 | 0.86222 | 0.94531 | 0.36265 | 0.76889 |
| 56 | 0.01 | l2 | liblinear | None | 3000 | 0.86222 | 0.94531 | 0.36265 | 0.76889 |
| 57 | 0.01 | l1 | liblinear | balanced | 1000 | 0.86222 | 0.94243 | 0.42650 | 0.76667 |
| 58 | 0.01 | l1 | liblinear | balanced | 3000 | 0.86222 | 0.94243 | 0.42650 | 0.76667 |
| 59 | 0.01 | l1 | liblinear | None | 1000 | 0.86000 | 0.94239 | 0.42652 | 0.76222 |
| 60 | 0.01 | l1 | liblinear | None | 3000 | 0.86000 | 0.94239 | 0.42652 | 0.76222 |

결과에서 확인되는 경향은 다음과 같다.

- `C=100`, L1, `liblinear`, `class_weight=balanced` 조합이 가장 낮은 Validation Log Loss를 기록했다.
- 1위와 2위는 평가 지표가 같아 더 작은 `max_iter=1000` 설정이 최종 선택됐다.
- `C=1~100` 구간은 Accuracy와 Search Top-1이 거의 동일했지만 Log Loss에서 차이가 났다.
- `C=0.01`은 정규화가 강해지면서 Log Loss와 Search Top-1이 모두 상대적으로 나빠졌다.
- 모든 조합에서 `max_iter=1000`과 `3000`의 결과가 같아 1,000회 이내에 수렴한 것으로 해석할 수 있다.

Test 데이터는 Validation 기반 모델 선택과 Train+Validation 최종 재학습이 모두 끝난 뒤 마지막 평가에만 사용했다.

## 6. 평가 방식

- Pair probability는 정방향과 역방향 예측을 결합한 symmetric probability를 사용한다.
- Search Top-1은 세 후보 간 pair probability를 합산하는 Probability Sum 방식으로 계산한다.
- 평가 지표는 Accuracy, ROC-AUC, Log Loss, Search Top-1이다.

Symmetric probability의 최대 방향 오차는 Validation과 Test 모두 약 `2.22e-16`이었다.

## 7. 실행 결과

| 지표 | Validation | Test |
|---|---:|---:|
| Pair Accuracy | 86.56% | 87.89% |
| ROC-AUC | 0.94912 | 0.95834 |
| Log Loss | 0.28397 | 0.26443 |
| Search Top-1 | 77.11% | 79.11% |
| Search 수 | 450 | 450 |

Validation은 Train 70%로 하이퍼파라미터를 선택했을 때의 지표이고, Test는 선택된 설정을 Train+Validation 85%로 새로 학습한 최종 저장 모델의 지표다.

정밀 값:

| 지표 | Validation | Test |
|---|---:|---:|
| Pair Accuracy | 0.8655555555555555 | 0.8788888888888889 |
| ROC-AUC | 0.9491202150420746 | 0.9583448561946902 |
| Log Loss | 0.2839713889984443 | 0.2644348660580615 |
| Search Top-1 | 0.7711111111111111 | 0.7911111111111111 |

## 8. 생성 산출물

산출물 위치:

```text
ml/artifacts/logistic_q2_q4/
```

| 파일 | 내용 |
|---|---|
| `logistic_model.joblib` | Train+Validation 85%로 최종 재학습한 scaler와 Logistic 모델 |
| `metrics.json` | 선택 단계, 최종 재학습 조건, Validation grid, Validation/Test 지표 |
| `coefficients.csv` | feature별 최종 Logistic 계수와 Train+Validation 표준편차 |
| `validation_grid.csv` | 60개 하이퍼파라미터 조합의 Validation 결과 |
| `validation_predictions.json` | Validation search별 예측 결과 |
| `test_predictions.json` | Test search별 최종 예측 결과 |

`ml/artifacts/*`는 `.gitignore` 대상이므로 위 산출물은 현재 로컬에만 저장된다.

## 9. 검증 결과

학습 후 저장된 `logistic_model.joblib`을 다시 로드하여 다음을 확인했다.

- 필요한 산출물 6개가 모두 존재한다.
- 저장된 최종 모델로 다시 계산한 Test 지표가 `metrics.json`과 정확히 일치한다.
- Validation 지표와 예측은 Train 70%로 학습한 선택 단계 모델의 결과로 보존된다.
- Validation grid 결과가 60개이며 제외된 후보가 없다.
- 최종 scaler가 Train+Validation 5,100행으로 fit됐고 Test 900행은 fit에서 제외됐다.
- 실행 후 추적 중인 기존 소스 파일에는 변경이 없다.

## 10. 최초 multiplier 직접 시뮬레이션의 제한사항

이 절은 보존된 최초 `ml/data/q2_q4/` 실행에만 해당한다. 해당 데이터의 `m_time`, `m_distance`는 실제 사용자 Q4 응답을 Logistic으로 fitting한 결과가 아니다.

- 범위: `[0.5, 2.0]`
- 합성 방식: 두 multiplier를 독립적인 LogUniform 분포에서 생성
- Q2 우선순위가 없거나 Q4 문항이 학습 조건을 만족하지 않는 경우: `[1, 1]` fallback
- `lambda=1`, 최소 유효 응답 3개, `minimumDesignRatio=0.01`은 현재 합성 데이터 메타데이터에서 참고 정책으로만 기록되어 있으며 합성 multiplier 계산에는 직접 실행되지 않는다.

따라서 이번 결과는 **동일한 합성 Q2+Q4 데이터로 Logistic과 XGBoost를 비교하기 위한 실험 결과**로 해석해야 한다. 실제 사용자 Q4 응답으로 산출한 multiplier의 효과를 입증하는 결과는 아니다.

최신 `ml/data/q2_q4_fitted/` 데이터는 별도 생성기로 다시 생성했으며, 메타데이터에는 원본 생성기와 전용 생성기의 해시를 각각 기록한다. 팀 공통 원본 파일은 브랜치 HEAD와 동일한 상태로 보존된다.

## 11. 후속 비교

팀원의 XGBoost 실험은 다음 항목을 이번 Logistic 실행과 동일하게 유지해야 한다.

- `synthetic_pairwise_q2_q4.csv`
- Train/Validation/Test split
- `m_time`, `m_distance`
- A/B 배치와 Y
- sample weight 규칙
- 평가 대상 search
- symmetric probability
- Probability Sum 기반 Search Top-1
- Validation Log Loss 우선 모델 선택

XGBoost 결과가 나오면 기존 Q2-only Logistic/XGBoost baseline과 함께 동일한 네 지표로 최종 비교한다.
