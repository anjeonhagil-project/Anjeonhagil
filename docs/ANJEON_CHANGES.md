# Anjeonhagil 통합 변경 안내

`feature/service-integration`의 현재 작업은 **기본 틀 준비를 넘어 실제 서비스 연결까지 구현한 상태**다. 최신 통합 기획서·팀 알고리즘/모델 ZIP을 반영했고 동결 데이터의 내부 버전 식별자는 유지했다. 상세 원자료 규칙은 기존 기획서와 ZIP README를 참고한다.

## 바뀐 기능

| 영역 | 구현한 내용 |
|---|---|
| 설문 | Q3 제거, Q1/Q2 공통 폼, 순위→가중치 검증, Q4 정확히 4문항 및 A/B/판단보류 저장·재개 |
| 경로 | 서울 경계·40m 도로 스냅, 방향·회전 제한·부분 arc를 유지한 A*와 Yen 목표 K=10, 제한시간과 중복 병합 |
| 화면 | 내게 편한 길/최단시간/최단거리 1~3장, 별도 모델 추천 표시, 최단시간 후보 대비 시간·거리·선택 부담 요소 차이, 카카오 지도·장소 검색·즐겨찾기 연결 |
| 모델 | 팀 Logistic·XGBoost 아티팩트 연결, 공통 X8·Train scale·대칭 확률·확률 합 순위, Logistic 운영 |
| 이력 | 계산값 재검산 후 검색 snapshot 저장, 실제 노출과 최종 선택 분리·멱등성, 새로고침·최근 경로 복구 |
| 개인화 | 실제 선택 기반 파일럿 보정, 최근 구간 검증 후 채택, 끄기·초기화, 이전 snapshot 보존 |
| 운영 | 공지·문의 실제 DB 연결, 관리자 운영/경로/실패/데이터/모델/권한 화면, 일반 사용자 권한 차단 |
| 실행 | 하나의 시작 명령, 의존성 고정, 데이터·DB·모델·브라우저 검증 스크립트, 줄바꿈 무결성 설정 |

기능을 별도 구현한 곳과 겹치는 **주석만 있는 미사용 파일 46개**는 제거했다. 예전 Q3 입력 컴포넌트, 중복 모델 호출 틀, 미연결 pgRouting/worker 틀 등이 대상이며, 기능 코드를 삭제한 것은 아니다.

## 주요 구조

```text
apps/backend/
  routing/
    data/                         원본 ZIP에서 복원한 SQLite/GPKG 9개 (Git 제외)
    tools/serve.py                내부 Python HTTP 계산기
    tools/runtime/
      integrated_service.py      실제 서비스 후보 생성·대표 선정·모델 순위
      routing_service.py         방향 스냅·시간대 A*·검산·geometry
      search_engine.py, yen.py    팀 알고리즘 통합 및 회전 이력 보존
    service_manifest.json        원본 반입 기록 보존
    runtime_manifest.json        현재 실행 코드 해시
    tests/                       A*/Yen 회귀 검사
  src/config/q4Cases.json         검산된 24문항, 고유 경로 43개
  src/modules/preferences/        Q1/Q2·Q4·개인화
  src/modules/routes/             검색·노출·선택·snapshot
  src/modules/admin/dashboard/    운영 조회 API
  src/routing-engine/             worker 호출·계약·재검산
apps/frontend_mobile/src/
  features/onboarding/            실제 Q4 진행
  features/routes/                비교·선택·최근 경로
  features/my/                    설문 변경·개인화·공지·문의
  components/map/RouteMap.jsx     카카오 경로 지도
apps/frontend_admin/src/features/dashboard/
                                  운영·데이터·경로·관리자 화면
ml/
  bundled/                        운영 Logistic JSON, 비교 XGBoost JSON·메타데이터
  data/synthetic_pairwise.csv      팀 합성 학습 자료
  src/                            추론·재학습·평가·실제 선택 변환·행동 보정
database/
  migrations/20260916_service_integration.sql
  manage.py, export_choices.py    원격 상태/반영/활성화·실제 선택 내보내기
scripts/                          시작·복원·검증·벤치마크
```

## DB와 데이터 상태

원격 Supabase에 통합 migration을 적용했고 **16개 ag_* 테이블**, 활성 데이터 `anjeon_final_20260915_child100_v3`, 활성 모델 `logistic_synthetic_20260916`을 확인했다. 기존 baseline/인증 테이블은 유지한다.

- Q4: `ag_q4_sessions/responses`에 저장. `ag_choices` 및 행동 건수와 분리한다.
- 검색/학습: `ag_searches/candidates/exposures/choices`에 당시 계산값과 가중치·모델을 고정한다.
- 행동 보정: `ag_profile_versions/user_profiles/profile_update_jobs`에 새 버전과 검증 근거를 저장한다.
- 실패: `ag_route_failures`에 오류 코드·소요시간을 기록한다.
- 도로 데이터는 백엔드 로컬 SQLite/GPKG에 적재했다. 동일 도로를 Supabase에 중복 적재하지 않는다.
- 새 migration은 재실행 검증을 통과했다. 통합 후 `manage.py apply`는 구 foundation 함수로 돌아가지 않도록 차단한다. 변경 반영은 `integrate`, 조회는 `status`다.

## 개인화에서 이번에 정한 파일럿 정책

`ml/src/personalize.py`의 **실험 정책**이며 최적 성능이 입증된 상수가 아니다. 실제 서비스 선택만 최근 7일에서 10건 이상이면 사용하고, 부족하면 30일까지 확장하여 최대 20건을 사용한다. Q2 미선택 요소는 계속 0이다.

고정 Logistic 아래에서 오래된 80% 선택으로 가중 Log Loss + 설문 이탈 정규화(0.05)를 최소화한다. 반감기 H=14일, consistency는 학습 구간에서 선택 경로의 평균 pair logit이 양수인 검색 비율이다. `n_eff=최근성 가중치 합×consistency`, `α=n_eff/(n_eff+10)`, `effective=(1−α)survey+αbehavior`다. 최신 20%(최소 2건)의 loss가 현재 프로필보다 0.001 이상 개선될 때만 채택한다. 이력 부족·모델 장애·검증 실패는 기존/설문 가중치를 유지한다. 모든 정책값과 전후 오차를 job evidence에 남긴다.

Q4는 응답 저장까지만 연결했다. 시간·거리 허용 계수나 행동 학습에 반영하지 않는다. Q2 무선택은 기본 비교 사례임을 표시하며 선호로 저장하지 않는다.

## 팀원이 확인할 위치

- **A* 담당:** `integrated_service.py/search_engine.py/yen.py`와 `scripts/test-algorithms.py`, `benchmark-routing.py`. burden A*는 후보를 찾기 위한 근사 비용이고, 최종 raw6를 다시 계산해 후보 안에서 대표 경로를 고른다. 코드 수정 뒤 `node scripts/build-runtime-manifest.mjs`와 검증을 실행한다.
- **모델 담당:** `ml/src/train.py`는 팀 자료의 학습/평가를 재현한다. 실제 로그는 `database/export_choices.py --output .test-tools/choices.jsonl` → `ml/src/train.py --choices .test-tools/choices.jsonl` 순서다. 사용자 분리, 재현 가능한 A/B 배치, 검색별 pair 가중치 합 1을 검사한다. 결과는 `ml/artifacts/`에 생성하며 자동 활성화하지 않는다.
- **앱 담당:** 검색 당시 snapshot을 화면·추천·선택 저장의 기준으로 유지한다. Q4를 실제 선택으로 합치거나 브라우저에서 raw6를 만들어 전송하지 않는다.

## 실행·검증 파일과 Git

`scripts/start-local.mjs`, `setup-python.ps1`, `import-routing-data.ps1`, `verify-routing-data.mjs`, `build-runtime-manifest.mjs`, **test-*.py/mjs/ps1**, `benchmark-routing.py`는 팀 재현에 필요하므로 포함한다. 모델 JSON/메타데이터·합성 CSV·Q4 사례·migration·package-lock·gitattributes도 포함한다.

`.env`, `.venv`, `node_modules`, `dist`, `.test-tools`, 학습 출력 `ml/artifacts`, 대용량 도로 데이터는 제외한다. 예전 검토 문서 3개는 계속 Git에서 제외한다. 원본 ZIP 전체를 Git에 넣을 필요는 없다.

새 PC는 Node.js 24 이상/Python 3.12와 각 앱의 `.env.example`에 맞는 로컬 설정을 준비한 뒤:

```powershell
npm ci
.\scripts\setup-python.ps1
.\scripts\import-routing-data.ps1 -ArchivePath 'C:\자료\Anjeonhagil_FINAL_CHILD100_20260915 (1).zip'
npm run doctor -- --db
npm run test:local
npm start -- --api-port=3001
```

공유 Supabase를 쓰는 팀원은 migration을 매번 재적용하지 않는다. 카카오 허용 주소는 `http://localhost:5173`이다. 다른 포트를 쓰면 카카오 허용 주소도 별도로 맞춰야 한다.

### 별도 Supabase를 새로 만드는 경우만

`database/bootstrap.py`는 baseline 01~05와 최신 migration 두 개를 조합한다. 기존 테이블이 있으면 거부하며 한 트랜잭션으로 적용한다. PostGIS를 준비하고 과거 pgRouting/위험도 seed는 설치하지 않는다. 도로는 위 ZIP 복원으로 준비한다.

```powershell
# 새 프로젝트의 backend/.env 및 두 프론트 .env 설정 후
.\.venv\Scripts\python.exe -X utf8 database/manage.py bootstrap
npm run test:local
.\.venv\Scripts\python.exe -X utf8 database/manage.py activate
npm run doctor -- --db
```

최초 관리자만: 서비스 회원가입·이메일 확인 후 Auth의 해당 사용자 UUID로 `database/manage.py init-admin --user-id <UUID>`를 Python으로 실행한다. 관리자가 이미 있으면 거부하며 이후 권한 변경은 관리자 화면에서 한다. 소셜 공급자, 이메일 인증 및 localhost 리다이렉트 설정은 Supabase/카카오/네이버 콘솔에서 별도로 맞춘다. 키·비밀번호는 Git에 넣지 않는다.

### 이번 재현성 보완과 확인

- `scripts/doctor.mjs`: 앱 설정·프로젝트 일치·공개 설정의 비밀키 혼입·Python·데이터 해시·원격 38개 테이블의 RLS/권한·활성 모델 해시 확인. `npm run doctor -- --db`로 실행한다.
- `scripts/test-bootstrap.py`: 실제 PostGIS의 격리 스키마에서 신규 구성·가입·설문·첫 관리자·재실행 거부를 검사하고 전부 롤백한다. 현재 원격 데이터를 초기화하지 않는다.
- `scripts/start-local.mjs`: 포트 중복/범위 검증, worker와 API 준비 후 화면 서버 실행.
- Git 대상 파일만 별도 복사해 `npm ci`, 계약/비교 검사, 두 화면 빌드 통과. `.env`·Python·도로 데이터 누락도 감지했다. 실행 검증 스크립트는 Git에 포함하고 `.test-tools` 결과는 제외한다.

확장 우선순위는 **실제 선택 자료로 모델 평가 → 다양한 서울 OD의 경로 품질·제한시간 회귀 검사 → 동시 요청 대기열/취소**다. Q4 반영은 시간·거리 허용 정책을 검증한 뒤 진행한다. 지금은 기능 수보다 기존 추천의 근거와 재현성을 높이는 편이 포트폴리오에 유리하다.

### 관리자 시안 반영

청록색 사이드바·통계 카드·표·상세창을 통일했다. 대시보드는 한국 시간 기준 오늘/이번 달/올해의 저장된 검색을 실제 DB count로 집계한다(30초 캐시). 데이터·모델 상세와 최근 50건 기록의 검색/상태 필터/10건 페이지 이동, 관리자 이메일 검색·권한 변경 확인창을 추가했다. 공지는 비공개 초안 또는 공개 상태로 저장할 수 있다. 정상 문의 UUID가 거부되던 검증식을 수정했다. 기존 DB 구조를 그대로 사용하며 추가 migration은 없다. `test-admin-usage.mjs`와 관리자 Chrome 검사 18개(임시 비공개 공지·테스트 문의 답변 포함)를 통과했다.

모바일은 최상위 프레임과 본문이 동시에 움직이던 중첩 스크롤을 제거하고, 화면별 본문 하나만 터치 스크롤하도록 통일했다. 390×430 화면에서 온보딩 설문·선택 경로·마이페이지·운전 부담 설정·도움말·긴 약관의 실제 스크롤 이동을 포함한 사용자 Chrome 검사 28개를 통과했다.
