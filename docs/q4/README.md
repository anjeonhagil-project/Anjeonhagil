# Q4 재학습 전 준비 — 팀원 인계

**상태: 시험 계수 산출·데이터 내보내기까지 구현. 공통 모델 재학습과 새 계수의 운영 추천 적용은 하지 않음.**

## 1. 먼저 알아야 할 결정

| 구분 | 결정 |
|---|---|
| 문항 수 | 6개 부담 요인 × 4개 비교 = 24개 유지. 한 사용자는 Q2 최우선 요인의 4개에 응답 |
| 새 문항 의미 | 시간 2개·거리 2개를 중심으로 **8개 조건을 함께 비교**. SMALL/LARGE 응답으로 허용 한계를 단정하지 않음 |
| 숫자 출처 | 실제 내부 경로 후보에서 재선정. 시간·거리·부담 수치를 편집하지 않음 |
| 모델 X | 시간 차이, 거리 차이, Q2 가중 부담 차이 6개. 기존 8차원 유지 |
| Q4 결과 | 시간·거리 multiplier 2개의 **시험 추정치**. 공통 Logistic 계수와 다른 값 |
| 운영 동작 | 기존 legacy Q4 보조 정책은 해당 기존 응답에만 유지. 새 문항·시험 계수는 운영 점수에 적용하지 않음 |
| Q4 재설문 | Q2·행동 가중치·history_start_at 유지. Q4 revision만 증가. 중단 후 이어서 답변 가능 |
| Q2 변경 | 새 survey_version에 종속된 Q4를 다시 수집. 이전 Q2 기준 Q4를 새 Q2에 자동 복사하지 않음 |
| 최종 판단 | 숫자 안정성은 검사할 수 있지만, 실제 사용자 예측력은 팀원 실험과 별도 응답 수집이 필요 |

## 2. 문항 감사 자료 읽는 법

- `bank-audit.json`: 원래 24문항의 before, 새 문항의 after, 후보 수, 시간·거리 설계행렬 진단.
- `BANK_REVIEW.md`: 24문항의 시간·거리·부담 변화량을 읽기 쉬운 표로 정리한 검토 결과.
- `trial-validation.json`: 각 요인의 A/B/UNSURE 81패턴, 정규화 민감도, 계수 범위. 실제 사람을 대상으로 한 성능 결과가 아님.
- 서비스 문항 원본: `apps/backend/src/config/q4Cases.json`.
- 원천 재계산: `.venv/Scripts/python.exe -X utf8 scripts/test-q4-data.py`.

`training_eligible=false`인 문항은 정식 학습에서 제외한다. 답변은 버리지 않고 감사·후속 문항 개선용으로 보존한다. 특히 합류·분기는 확보한 경로 후보에서 강화한 기준을 만족하는 비교쌍이 부족하면 보류한다. 후보가 없다고 수치를 조작하거나 기준을 몰래 완화하지 않는다.

선별 기준은 **이번 파일럿의 엔지니어링 기준**이며 심리측정학적으로 검증된 임계값이 아니다.

| 검사 | 기준 / 해석 |
|---|---|
| 목표 부담 차이 | 기존 요인별 최소량, 상대 개선 20%, 기존 scale 기준 0.5 이상 |
| 다른 부담 변화 | 표준화 변화 절댓값 합 / 목표 개선 ≤ 1. Q2 가중치나 모델 beta를 적용한 최종 효용 비율은 아님 |
| 시간 중심 문항 | 추가 시간 60~300초; 표준화 거리 차이 ≤ 표준화 시간 차이의 0.5 |
| 거리 중심 문항 | 추가 거리 100~1,500m; 표준화 시간 차이 ≤ 표준화 거리 차이의 0.5 |
| 경로 중첩 | 방향 arc Jaccard ≤ 0.8 |
| 중복 | 동일 경로쌍 및 사용자에게 거의 같은 숫자로 표시되는 조합 제외 |
| 시간·거리 분리 | 4×2 표준화 차이 행렬의 Gram 고유값 비율 ≥ 0.03. 단위와 scale에 의존하며 통계적 정확도를 보장하지 않음 |

다른 부담 요인이 함께 변하는 것 자체는 학습 금지 사유가 아니다. 모든 차이를 X에 넣는다. 다만 4개 선택으로 8개의 개인 계수를 모두 추정할 수 있다고 해석해서는 안 된다.

## 3. X8, Y 규격 — 순서와 단위 고정

| 인덱스 | 이름 | 계산 |
|---:|---|---|
| 0 | time_diff | A.display_duration_s − B.display_duration_s (초) |
| 1 | distance_diff | A.distance_m − B.distance_m (m) |
| 2 | intersection_weighted_diff | (A.raw6[0] − B.raw6[0]) × Q2[0] |
| 3 | merge_weighted_diff | (A.raw6[1] − B.raw6[1]) × Q2[1] |
| 4 | narrow_weighted_diff | (A.raw6[2] − B.raw6[2]) × Q2[2] |
| 5 | turn_weighted_diff | (A.raw6[3] − B.raw6[3]) × Q2[3] |
| 6 | consecutive_weighted_diff | (A.raw6[4] − B.raw6[4]) × Q2[4] |
| 7 | child_100m_weighted_diff | (A.raw6[5] − B.raw6[5]) × Q2[5] |

`Y=1`은 표시된 A 선택, `Y=0`은 표시된 B 선택이다. UNSURE는 null이며 이진 선택 정답에서 제외한다. A/B 순서 반전 시 X와 Y가 함께 반전되어야 한다.

내보낸 `x_base`는 **스케일링 전 값**이다. Q2 가중치는 이미 적용되어 있으므로 다시 곱하지 않는다. 시간은 원시 internal_duration_s가 아닌 사용자가 본 분 단위 반올림 초를 사용한다. raw6 순서와 단위는 기존 계약을 유지한다. 어린이 관련 값은 법정 보호구역 면적이 아니라 시설 중심 100m 원 내부 통과 거리다.

추후 Q4 적용 후보 입력:

```text
X_q4 = [m_time × X_base[0], m_distance × X_base[1], X_base[2:8]]
z = sum(beta[i] × X_q4[i] / training_scale[i])
P(A) = sigmoid(z)
```

시간·거리 multiplier와 6개 부담 가중치를 합계 1로 재정규화하지 않는다. multiplier 1은 시간·거리 기본 민감도를 유지한다는 뜻이다. 8개 feature라고 해서 모든 가중치의 단위와 역할이 같은 것은 아니다.

## 4. 시험 계수 산출의 가정과 한계

코드: `ml/q4-trial.mjs`, 정책 버전: `q4_trial_20260917_v1`.

공통 합성데이터 Logistic beta와 scaler, Q2 6가중치를 고정하고 `m_time`, `m_distance`만 적합한다.

```text
min mean(binary_log_loss(Y, P(A))) + lambda × (log(m_time)^2 + log(m_distance)^2)
```

현재 시험값은 범위 `[0.5, 2]`, lambda `1`이다. log-space 격자 탐색 후 국소 세분화로 재현 가능한 결과를 얻는다. `[0.25, 1, 4]` 정규화 민감도도 보고한다. 이 값은 서비스 적용 승인을 받은 최적 파라미터가 아니다.

- 유효 A/B 응답이 3개 미만이면 `[1,1]`로 보류.
- 응답한 비교쌍의 시간·거리 설계 비율이 0.01 미만이면 `[1,1]`로 보류.
- 검증되지 않은 문항은행, Q2 기준 요인 없음은 `[1,1]`로 보류.
- SMALL 거부/LARGE 수용을 자동으로 비일관적이라 처리하지 않음.
- `fittedLoss`는 같은 응답에 적합한 훈련 손실이다. 일반화 성능으로 발표하지 않음.
- 이 추정은 **기존 합성 모델을 조건으로 한 값**이다. 새 beta/scaler로 재학습하면 계수의 의미도 변할 수 있으므로 동일 산출물을 무조건 재사용하지 않음.
- 현재 4응답과 짧은 거리 차이에서는 거리 계수의 정보가 약하다. 기본값 근처 결과를 '거리 선호 없음'으로 단정하지 않음.
- confidence 퍼센트, 정확한 우회 허용 초/m는 제공하지 않는다. 근거 없는 정밀도를 만들지 않기 위함이다.

## 5. 데이터 내보내기

실제 응답은 DB에서 읽기 전용으로 추출한다. 코드 저장소에 사용자 응답 파일을 커밋하지 않는다.

```powershell
# Q4_EXPORT_KEY는 담당자가 비밀 저장소에서 주입한 32자 이상의 고정 비밀값.
# 같은 사용자를 실험 간 동일하게 묶으려면 같은 키를 사용하고 키 자체는 공유 파일에 넣지 않는다.
node scripts/export-q4-training.mjs --database --output=.test-tools/q4-export
```

DB가 없는 팀원은 `{session, answers, survey_weights}` 객체 배열 JSON을 `--input=경로`로 전달할 수 있다. 테스트 응답을 실제 이용자 데이터로 보고하지 않는다.

출력:

| 파일 | 용도 |
|---|---|
| q4-training.json | 원본 경로 수치, Q2 가중치, 응답, 버전, 익명 사용자·세션, trial 감사 결과 |
| q4-pairs.csv | X_base 8열과 Y, 학습 가능 여부. UNSURE 행은 Y가 빈 값 |
| manifest.json | feature 순서, 모델 hash, 행 hash, 행 수 및 적격 행 수 |

HMAC으로 사용자·세션 ID를 가명화하고 이름·이메일·정밀 출도착 좌표는 내보내지 않는다. 가명 데이터도 접근을 제한한다. 완료 세션만 내보내며 이전 revision도 남기므로 사용자·시간 분리를 반드시 적용한다.

Python 로더도 제공한다. `ml/src/q4_data.py`의 `load_q4(path)`는 `(DataFrame, metadata)`를 반환한다. UNSURE/보류 문항을 제외하고 원본에서 X8을 재계산해 이중 가중치·스케일링 오류를 검사한다. 기존 `train.py --choices`는 실제 서비스 선택 전용이며 이 Q4 JSON을 직접 받지 않는다. 학습 담당자가 아래 로더 결과를 별도 실험에 사용해야 한다. 이번 작업에서는 fit을 실행하지 않았다.

```python
# ml/src를 Python 경로에 추가한 실험 노트북/스크립트에서 실행
from q4_data import load_q4
from features import FEATURES
frame, metadata = load_q4('q4-training.json')
X = frame[FEATURES]  # unscaled, Q2 already applied
y = frame['y']
groups = frame['user_id']
# 그룹별 표본/label 분포를 확인한 뒤 학습 담당자가 분할과 fit을 수행한다.
```

실제 선택 이력과 합칠 때에는 **두 데이터의 사용자 식별자를 먼저 통일**한다. Q4의 가명화는 `HMAC-SHA256(key, 'user:' + original_user_uuid)`이다. 기존 실제 선택 export의 user_id에도 동일한 키·접두어·인코딩(UTF-8)을 적용한 뒤 사용자 단위로 분리해야 한다. 원래 UUID와 HMAC을 서로 다른 사용자로 취급하면 데이터 누출이 발생한다.

## 6. 팀원의 재학습 순서 — 데이터 누출 방지

1. `training_eligible=true`, `Y in {0,1}`만 정식 Q4 학습 후보로 사용한다. 선택하지 않은 다른 요인의 20문항을 사용자 응답으로 생성하지 않는다.
2. 사용자 단위로 train/validation/test를 나눈다. 같은 사용자의 재설문·A/B 반전 복제본을 서로 다른 split에 넣지 않는다.
3. Q4 계수 추정용 calibration 응답과 평가용 실제 선택을 나눈다. **평가할 답변으로 계수를 먼저 만든 뒤 그 답변을 예측하지 않는다.**
4. `trial_audit`의 전체 세션 적합 계수를 같은 세션의 학습 X에 곱하지 않는다. 편의를 위해 CSV에는 이 계수를 넣지 않았다.
5. 기준선은 같은 데이터·분할·학습 방식에서 `[1,1]`을 사용한다. 비교안은 calibration 응답으로만 추정한 Q4 multiplier를 후속 선택의 X에 적용한다.
6. 전체 합성 모델을 고정한 시험은 기존 scaler를 그대로 사용한다. 새 공통 모델 학습은 train에서만 새 scaler를 적합한다. 모델별 scale과 feature 순서를 따로 기록한다.
7. Q4 응답을 공통 학습에 추가하는 실험은 별도로 한다. 실제 선택과 출처를 구분하고 Q4 sample weight 후보는 validation으로 선택한다. '주행 완료=더 진실한 선호'라는 근거 없는 가중치는 넣지 않는다.
8. 선택 정확도, log loss, 검색별 top-1, 기본값 대비 개선, 계수 경계 도달·보류율을 보고한다. Q2 기준 요인별 성능, 문항은행 버전별 결과도 분리한다.
9. Q4를 적합하는 데 쓴 고정 beta와 재학습 beta의 순환 의존성은 명시한다. 계수 재추정 시 train 내부에서 수행하고 최종 test는 튜닝에 사용하지 않는다.

**현 시점에 적격 실제 응답이 없다면 파이프라인 준비만 완료된 것이다. 시험 패턴으로 만든 답을 실제 정답처럼 재학습·성능 보고하지 않는다.**

## 7. 모델을 돌려준 뒤 연결하기 위한 반환 규격

- feature_order 8개와 단위, Q2 적용 위치, Q4 multiplier 적용 위치.
- scaler 값·fit split·버전, intercept/with_mean 설정.
- 모델 artifact와 SHA256, 학습 데이터 manifest/hash 및 출처.
- Q4 estimator 버전, calibration 모델/scaler 버전, bounds·regularization.
- 사용자 분리 방식, 기준선과 비교 성능, 실제 데이터 수·요인별 표본 수.
- Logistic/XGBoost 중 채택 대상. XGBoost에 Logistic용 multiplier를 검증 없이 그대로 적용하지 않음.
- 고정된 입력 몇 건에 대한 X, 예측 확률, 최종 순위 golden fixture.

새 모델 연결 때에는 DB model registry·worker·검증기·export 계약을 함께 맞추고 기존 Q4 후처리와 중복 적용되지 않도록 한다. 현재 변경은 모델 파일·운영 X 계산·경로 후보 탐색을 바꾸지 않는다.

## 8. DB 적용과 검증

기존 DB에는 과거 migration을 거꾸로 실행하지 않는다. 새 코드 시작 전에 다음 additive migration을 적용한다.

```powershell
.venv/Scripts/python.exe -X utf8 database/manage.py q4-training
```

`20260917_q4_training_prep.sql`은 Q4 revision, 재설문 요청, 불변 시험 계수 테이블을 추가한다. 신규 DB bootstrap에도 포함되어 있다. 사용자 잠금으로 두 탭의 시작·재시도를 직렬화하고 다른 사용자/이전 Q2/이전 revision 쓰기를 거부한다.

```powershell
npm.cmd test
node scripts/test-q4-revisions.mjs
node scripts/test-q4-trial.mjs
node scripts/test-q4-ui.mjs
.venv/Scripts/python.exe -X utf8 scripts/test-q4-data.py
npm.cmd run build
```

UI 검사는 실제 React와 Chromium을 사용하되 API는 fixture다. 지도 외부 연결·운영 Supabase·배포 환경 인증을 검증했다고 해석하지 않는다. 원천 경로/모델 검사는 별도 Python 런타임에서 실행한다.
