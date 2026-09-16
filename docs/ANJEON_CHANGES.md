# Anjeonhagil 변경 및 팀 개발 안내

이 문서는 기획 변경에 맞춰 준비한 **파일 구조, DB, 실행 환경과 담당별 다음 작업**을 한 번에 공유하기 위한 문서다. 세부 제약·데이터 계산 규칙은 전달받은 원본 ZIP의 `README.html`과 기획서를 기준으로 한다.

## 1. 이번에 준비한 범위

- 기존 회원·인증·장소·즐겨찾기·공지·문의 코드는 유지했다.
- 기존 실행 파일 58개에는 대부분 첫줄에 `수정 필요(Anjeonhagil)` 주석만 추가했다. 기존 앱 파일 191개의 실행 로직이 바뀌지 않았음을 별도로 대조했다.
- Git에 포함할 신규 파일은 이 문서를 포함해 74개다. 계산기 27개, 백엔드 골격 13개, 모바일 골격 11개, DB 5개, ML 골격 9개, 실행·검증 스크립트 8개, 이 문서 1개다.
- 신규 JS/Python 화면·서비스 파일 중 상당수는 **역할과 입력·출력만 적은 주석 골격**이다. 파일 존재를 기능 구현 완료로 판단하지 않는다.
- 최신 데이터에서 필요한 Python A* 계산기와 계약 파일만 `apps/backend/routing/`으로 가져왔다. 전체 ZIP 서비스 소스나 전체 도로 DB를 Supabase에 복제하지 않았다.
- 원격 Supabase에는 기존 22개 테이블을 유지하고 신규 13개 `ag_*` 테이블과 학습 조회 view를 추가했다. 검증된 데이터 릴리스는 `ready/active`, 현재 모델은 `survey_only_v1`이다.

검증 결과는 데이터 파일 29개 해시와 SQLite/GeoPackage 9개 무결성, HTTP 계산기 30개, migration·권한·Q4·저장 계약 89개, X8 학습 입력 6개가 통과했다.

## 2. 변경된 파일 구조

```text
apps/
├─ backend/
│  ├─ routing/                         Python A* 계산기, 계약 JSON, manifest
│  │  ├─ data/                         Git 제외, 전달 ZIP에서 복원
│  │  └─ tools/                        serve.py, runtime/, profile_adapter.py
│  └─ src/
│     ├─ config/                       온보딩 사례·개인화 정책
│     ├─ modules/models/               모델 조회·호환성·추론 호출 골격
│     ├─ modules/preferences/          Q1~Q4·개인화 골격
│     ├─ modules/routes/               추천·snapshot 저장 골격
│     ├─ routing-engine/               Python 호출·계약·후보 검증 골격
│     └─ workers/                      개인 프로필 갱신 worker 골격
├─ frontend_mobile/src/
│  ├─ components/map/RouteMap.jsx
│  └─ features/
│     ├─ preferences/                  Q1~Q3 공통 폼·항목·API
│     ├─ onboarding/RouteChoiceStep.jsx
│     ├─ routes/                       검색·노출·카드·표시 변환 골격
│     └─ my/PersonalizationSettings.jsx
ml/src/                                선택 데이터·분리·정규화·LR·XGBoost·추론 골격
database/
├─ migrations/20260916_anjeonhagil_foundation.sql
├─ manage.py                           원격 preflight/apply/status/activate
└─ export_choices.py                   실제 선택 학습 JSONL 내보내기
scripts/                               데이터 복원·환경 구성·실행·통합 검증
```

기존 `database/baseline/`과 2026-09-01/09-05 인증 migration은 변경 이력으로 유지한다. 새 서비스 기능은 신규 `ag_*` 구조를 사용하며, 기존 `driving_preferences`, `route_requests`, `road_*`에 중복 저장하지 않는다.

## 3. DB 구조와 연결 흐름

| 영역 | 테이블 | 역할 |
| --- | --- | --- |
| 데이터·모델 | `ag_dataset_releases`, `ag_dataset_active`, `ag_model_versions` | 계산기 데이터와 모델 버전 고정 |
| 설문·온보딩 | `ag_preference_history`, `ag_preferences`, `ag_onboarding_progress` | Q1~Q3 이력·현재 설문·Q4 완료 상태 |
| 개인화 | `ag_profile_versions`, `ag_user_profiles`, `ag_profile_update_jobs` | 적용 가중치 이력·활성 프로필·보정 작업 |
| 경로·학습 | `ag_searches`, `ag_candidates`, `ag_exposures`, `ag_choices` | 검색 당시 값·실제 노출·최종 선택 보존 |

흐름은 `설문 → 활성 프로필 → 경로 검색/후보 → 실제 노출 → 최종 선택 → 학습 view → 개인 프로필 갱신` 순서다. 브라우저가 신규 테이블과 RPC를 직접 호출하지 않고, 인증된 Express 백엔드가 service key로 호출한다.

원격 DB 적용은 끝났다. 다시 적용하거나 상태를 확인할 때는 실제 `.env`를 Git에 올리지 않고 다음 도구를 사용한다.

```powershell
.\.venv\Scripts\python.exe -X utf8 database/manage.py status
```

## 4. 담당별 다음 작업

### A* 담당

1. `scripts/import-routing-data.ps1`로 전달 ZIP의 9개 계산 데이터 파일을 복원하고 `scripts/verify-routing-data.mjs`로 해시와 DB 무결성을 확인한다.
2. `scripts/run-routing.ps1`로 내부 worker를 실행한다. 브라우저가 worker를 직접 호출하지 않으며 Express의 `routingClient.js`를 통해서만 호출한다.
3. `service_area.py`를 연결해 서울 경계 검사와 40m 도로 스냅을 구분한다.
4. 현재 `/search`는 `ranks`로 설문 가중치를 다시 만든다. `profile_adapter.py` 위치에서 서버가 검증한 `effective_weights`를 후보 생성과 최종 부담 정렬에 동일하게 적용한다.
5. `candidateValidation.js`에서 worker `/evaluate`로 segments, 거리, 시간, raw6를 재검산한 뒤 `routeSnapshot.js`를 통해 저장한다.
6. 기존 `pgRouting.js`, `costBuilder.js`, `snapToNetwork.js`에 두 번째 계산식을 만들지 않는다. 신규 서울 경로는 Python worker를 단일 계산 기준으로 사용한다.

### 모델 담당

1. `database/export_choices.py`가 내보낸 실제 노출·선택 JSONL을 `choice_data.py`에서 읽는다. 미노출 후보와 미선택 검색은 정답으로 만들지 않는다.
2. `split.py`에서 사용자 단위로 train/validation/test를 분리하고, `normalization.py`에서 **train만으로** X8 scale을 적합한다.
3. `logistic_model.py`와 `xgboost_model.py`는 같은 데이터·split·scale로 비교한다. 현재 `predict_choice.py`, `personalize.py`, `serve.py`는 주석 골격이므로 구현해야 한다.
4. 모델, scaler, 학습 manifest 해시와 평가값을 함께 저장하고 `ag_model_versions`에 새 버전으로 등록한다. 기존 버전을 덮어쓰지 않는다.
5. 실제 사용자 선택이 부족하면 `survey_only_v1`을 정상 fallback으로 유지한다. mock 정답 성능을 실제 개인화 성능으로 사용하지 않는다.
6. `modelInference.client.js`와 `modelCompatibility.js` 계약을 맞춰 Express가 후보 순위와 개인 보정 결과를 받을 수 있게 한다.

### 백엔드·모바일 담당

- `preferences`는 Q1 운전 빈도, Q2 6개 순위, Q3 `null/0/5/10/15`, Q4 2~3개 사례 선택을 연결한다. `users.onboarding`만 보지 않고 `ag_onboarding_progress.completed_at`을 함께 확인한다.
- `routes`는 검색 저장 → 실제 표시 후보 노출 저장 → 사용자의 명시적 최종 선택 저장을 분리한다.
- `RouteComparePage`와 Q4는 `RouteMap`, `RouteCandidateCard`, `useRouteExposure`를 재사용한다. 카드 미리보기를 실제 선택으로 저장하지 않는다.
- 개인화 끄기·초기화·프로필 갱신은 과거 snapshot을 수정하지 않고 새 profile version을 만든다.
- 기존 파일 첫줄의 `수정 필요(Anjeonhagil)` 주석을 구현 체크리스트로 사용한다.

## 5. 반드시 포함할 실행·검증 파일

| 파일 | 용도 |
| --- | --- |
| `scripts/import-routing-data.ps1` | Git에서 제외한 계산 데이터를 원본 ZIP에서 해시 검증 후 복원 |
| `scripts/setup-python.ps1` | Python 3.12 `.venv`와 라우팅·DB 의존성 설치 |
| `scripts/run-routing.ps1` | 로컬 Python A* worker 실행 |
| `scripts/verify-routing-data.mjs` | manifest 29개와 데이터 DB 9개 검사 |
| `scripts/test-foundation.ps1` | HTTP 계산 → 로컬 SQL → X8 계약 통합 검증 |
| `database/manage.py` | Supabase 사전 점검·migration·상태·릴리스 활성화 |
| `database/requirements.txt` | DB 도구의 PostgreSQL 드라이버 고정 |
| `database/migrations/20260916_anjeonhagil_foundation.sql` | 기존 DB에 신규 13개 테이블과 RPC/view 추가 |

처음 받은 팀원은 프로젝트 루트에서 다음 순서로 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/import-routing-data.ps1 -ArchivePath "원본 ZIP 경로"
powershell -ExecutionPolicy Bypass -File scripts/setup-python.ps1
node scripts/verify-routing-data.mjs
powershell -ExecutionPolicy Bypass -File scripts/test-foundation.ps1
powershell -ExecutionPolicy Bypass -File scripts/run-routing.ps1
```

## 6. Git에 포함하지 않는 파일

- 실제 `.env`와 `DATABASE_URL`, API key, worker token
- `.venv/`, `venv/`, `node_modules/`, `dist/`, `__pycache__/`
- `.test-tools/`의 테스트 DB·fixture·결과
- `apps/backend/routing/data/`의 SQLite/GPKG 약 463MB
- 학습 모델과 scaler 산출물
- 이번 문서로 통합한 `Anjeonhagil_REVIEW.md`, `Anjeonhagil_IMPLEMENTATION.md`, `FILE_STRUCTURE_AND_CHANGES.md`

`apps/backend/routing/service_manifest.json`, `final_release.json`, `IMPORT_MANIFEST.json`, `source_register.json`은 데이터 파일이 아니며 실행 버전과 출처를 검증하므로 반드시 Git에 포함한다. 내부 버전 식별자는 파일명 정리 대상이 아니므로 변경하지 않는다.
