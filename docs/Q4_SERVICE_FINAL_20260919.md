# 서비스 연결 · 제한 후처리 진행


## 1. 현재 운영 방식

**기존 Logistic 추천 + Q4 제한 후처리**입니다. 새 Q2+Q4 학습 모델로 교체한 것이 아닙니다.

```text
Q2·행동 가중치 → 기존 경로 탐색·Logistic 평가
             → 최신 완료 Q4로 근소한 후보만 보조 비교
             → 최종 추천·적용 내역 저장
```

- 팀원의 Logistic/XGBoost 학습 코드·모델·X8 입력·scaler·문항은행·경로 탐색은 유지했습니다.
- Q4는 시간·거리 선호를 후처리에 사용합니다. 기존 모델 입력과 예측값은 바꾸지 않습니다.
- 새 DB migration은 없습니다. 기존 Q4 준비 migration과 환경변수·도로 데이터가 필요하며, 적용 후 서버를 재시작해야 합니다.

## 2. Q4 규칙

| 항목 | 현재 동작 |
|---|---|
| 문항 | 24개 은행 중 Q2 최우선 부담에 해당하는 4개 응답. 화면에서는 **Q3**, 내부 API·DB에서는 **Q4** |
| 최신 응답 | 현재 surveyVersion의 최신 완료 Q4 사용. 재응답 중에는 같은 버전의 이전 완료 결과 유지 |
| 완료·보류 | 새 결과가 보류여도 이전 적용 가능한 결과로 되돌리지 않음 |
| 기본 추천 유지 | 미응답, 합류·분기, 최우선 부담 없음, 유효 답변 3개 미만, 시간·거리 선호 식별 부족, 모델 계약 불일치 등 |
| 과거 Q4 | 기존 정책 유지 → 새 문항 완료 시 새 정책으로 전환. 중복 적용 안 함 |
| Q1·Q2 변경 | 새 survey/profile version 생성 → 경로 비교 재응답 필요. Q1만 바꿔도 동일하며, 생략하려면 팀의 버전·이력 규칙 협의 필요 |
| 기록 | 검색 당시 Q4 revision·정책·모델 정보·기본/최종 추천·변경 이유를 snapshot에 저장. 과거 검색은 재계산하지 않음 |
| 끄기 | ‘추천 개인화 설정 → 경로 비교 답변을 추천에 참고’를 끄면 다음 검색부터 Q4 보정 중지 |

**후처리 제한:** 정규화 모델 점수 차이 ≤ 0.04, 보정값 ±0.02. 설문에서 관측한 시간·거리 차이 범위 안에서만 비교하고, 우회가 늘면 최우선 부담이 줄어야 합니다. 모든 비교 지표에서 불리한 후보는 제외하며 동점은 기본 추천을 유지합니다.

이 수치는 보수적인 프로젝트 설정이며 논문으로 검증된 최적값이 아닙니다. **합성 Train/Validation 검색 2,550건에서는 최종 추천 변경이 0건**이었습니다. 기능 연결은 검증했지만 실제 추천 품질 개선은 아직 입증하지 못했습니다.

## 3. 화면·저장 변경

- 상단: 최우선 부담 태그 + 경로 비교/추천 반영 상태.
- Q1: 운전 빈도 버튼. Q2: 선택 순서로 순위 지정, 이동·해제 가능. **저장은 기존 6개 정수 배열, 미선택은 0**.
- Q3: 같은 화면 안에서 비교 4문항 시작·재개·다시 하기. 실제 부담 수치·비교 막대·시간/거리 차이 표시, 지도·상세 표는 펼침 영역.
- 표시 감소율은 **부담 지표 차이**이며 사고 위험·체감 부담 감소율이 아닙니다.
- 기본 설정과 문항별 응답은 단계별 저장됩니다. 최종 완료 후 성공 알림 → 마이페이지 복귀. 가입은 기존 완료 흐름 유지.

## 4. 확인 파일

| 담당 | 파일과 용도 |
|---|---|
| 모델·추천 | [q4ServingPolicy.js](../apps/backend/src/modules/preferences/q4ServingPolicy.js): 보정식·제한·정책 버전 `q4_bounded_rerank_20260919_v1` |
| 프로필·DB 연결 | [q4Profile.service.js](../apps/backend/src/modules/preferences/q4Profile.service.js): 최신 완료 결과·보류·과거 정책 전환 |
| 기존 추정 로직 | [q4-trial.mjs](../ml/q4-trial.mjs): 기존 계수 추정. 이번 작업에서 변경하지 않음 |
| 화면 | [DrivingPreferencesPage.jsx](../apps/frontend_mobile/src/features/my/DrivingPreferencesPage.jsx), [PreferenceRankForm.jsx](../apps/frontend_mobile/src/features/preferences/PreferenceRankForm.jsx), [RouteChoiceStep.jsx](../apps/frontend_mobile/src/features/onboarding/RouteChoiceStep.jsx) |
| 후처리 재검증 | [test-q4-serving.mjs](../scripts/test-q4-serving.mjs): 적용·보류·기본 점수 보존·합성 자료 감사 |

**모델 교체 시 주의:** trial의 기준 모델 hash가 다르면 후처리를 적용하지 않습니다. 모델 파일만 교체하지 말고 estimator 버전·재추정·입력 계약을 함께 확인해야 합니다. `trial.policy.productionEnabled=false`와 서비스 후처리 적용 여부는 별개이며, 후처리 여부는 검색 snapshot의 `q4`에서 확인합니다.

## 5. 검증과 남은 마무리

- 통과: `npm test`, `npm run test:q4`, `npm run test:local`, 사용자·관리자 build.
- 실제 연결 검증: Q4 API 72개, 서비스 API 75개, Chrome 설문 흐름 29개. 모델 JS↔Python 계약 48개도 통과했습니다.
- UI 변경 후 재검증: 비교 표시 계산 15개, 모의 API UI 29개, 실제 Chrome 29개. 중계 오류 1건은 재실행에서 재현되지 않았으며 원인은 미확정입니다.
- **남은 일:** 팀 변경 검토 → 커밋·배포 → 발표 기기에서 로그인·설문·검색·선택·안내 전체 리허설. 실제 사용자 대상 Q4 효과 검증은 별도입니다.

발표 표현: **“기존 모델을 유지하면서 Q4를 제한 후처리에 연결하고 저장·재설문·추천 흐름을 검증했다.”**