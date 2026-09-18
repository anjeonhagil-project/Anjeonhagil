# Anjeonhagil 통합 변경 안내

2026-09-17 추가 변경은 [기획 정합성·경로 선택·부담 설명 수정](IMPLEMENTATION_20260917.md)이 최신 기준이다. 아래는 이전 통합 구현의 기록이며, 현재 DB는 `ag_personalization_queue`를 포함해 ag_* 18개/전체 40개 테이블이다. 개인화의 10건은 7일/30일 기간 선택 기준이며 시작 최소 건수가 아니다.

`feature/service-integration`의 현재 작업은 **기본 틀 준비를 넘어 실제 서비스 연결까지 구현한 상태**다. 최신 통합 기획서·팀 알고리즘/모델 ZIP을 반영했고 동결 데이터의 내부 버전 식별자는 유지했다. 상세 원자료 규칙은 기존 기획서와 ZIP README를 참고한다.

## 바뀐 기능

**경로 안내 추가:** 선택 결과에서 GPS 안내/시뮬레이션으로 이어진다. 모바일 접이식 패널과 PC 지도·검색 패널, 현위치·진행 구간·다음 방향·과거 교통자료 기준 잔여 시간, 음성 켜기/끄기, 배속·일시정지·완주, 위치 품질 검사·이탈 재검색을 구현했다. 지도는 카카오, 안내 경로는 선택한 내부 경로 그대로다. 차선/신호/상용 내비 수준의 주행 보장은 포함하지 않는다.

- `routing/tools/runtime/guidance.py`: 방향이 있는 도로 구간의 연결을 검증해 참고 안내 생성. 기존 알고리즘·모델·동결 버전 유지.
- `GET /api/routes/searches/:searchId/guidance`: 본인 소유 검색의 최종 선택만 조회. 기존 저장 경로도 지원하며 DB migration/재적재는 필요 없다.
- `frontend_mobile/src/features/navigation/`, `hooks/useGeolocation.js`: GPS/시뮬레이션·위치 품질·종료 정리. 이동 위치를 서버에 저장하지 않고 학습 선택 기록도 추가하지 않는다.
- **Git 포함:** `scripts/test-navigation.mjs`(GPS 수학/입력 검증), 기존 `test-service-routing.py`(안내 좌표 동일성), `test-service-api.mjs`(소유권·선택 검증), `test-ui.mjs`(화면·안내 흐름). `runtime_manifest.json`도 함께 포함한다. `.test-tools`와 인증서·키는 제외한다.
- 휴대폰 HTTPS 실행 옵션과 카카오 도메인 설정은 루트 README 참고. 자동 검증과 실제 휴대폰/도로 주행 검증은 구분한다.

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
  src/config/q4Cases.json         검산된 24문항, 고유 경로 46개
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
  migrations/20260917_q4_personalization.sql
  manage.py, export_choices.py    원격 상태/반영/활성화·실제 선택 내보내기
scripts/                          시작·복원·검증·벤치마크
```

## DB와 데이터 상태

원격 Supabase에 통합·Q4 migration을 적용했고 **17개 ag_* 테이블**, 활성 데이터 `anjeon_final_20260915_child100_v3`, 활성 모델 `logistic_synthetic_20260916`을 확인했다. 기존 baseline/인증 테이블은 유지한다.

- Q4: `ag_q4_sessions/responses/profiles`에 응답과 정책 버전별 해석을 저장. `ag_choices` 및 행동 건수와 분리한다.
- 검색/학습: `ag_searches/candidates/exposures/choices`에 당시 계산값과 가중치·모델을 고정한다.
- 행동 보정: `ag_profile_versions/user_profiles/profile_update_jobs`에 새 버전과 검증 근거를 저장한다.
- 실패: `ag_route_failures`에 오류 코드·소요시간을 기록한다.
- 도로 데이터는 백엔드 로컬 SQLite/GPKG에 적재했다. 동일 도로를 Supabase에 중복 적재하지 않는다.
- 새 migration은 재실행 검증을 통과했다. 통합 후 `manage.py apply`는 구 foundation 함수로 돌아가지 않도록 차단한다. 변경 반영은 `integrate`, 조회는 `status`다.

## 개인화에서 이번에 정한 파일럿 정책

`ml/src/personalize.py`의 **실험 정책**이며 최적 성능이 입증된 상수가 아니다. 실제 서비스 선택만 최근 7일에서 10건 이상이면 사용하고, 부족하면 30일까지 확장하여 최대 20건을 사용한다. Q2 미선택 요소는 계속 0이다.

고정 Logistic 아래에서 오래된 80% 선택으로 가중 Log Loss + 설문 이탈 정규화(0.05)를 최소화한다. 반감기 H=14일, consistency는 학습 구간에서 선택 경로의 평균 pair logit이 양수인 검색 비율이다. `n_eff=최근성 가중치 합×consistency`, `α=n_eff/(n_eff+10)`, `effective=(1−α)survey+αbehavior`다. 최신 20%(최소 2건)의 loss가 현재 프로필보다 0.001 이상 개선될 때만 채택한다. 이력 부족·모델 장애·검증 실패는 기존/설문 가중치를 유지한다. 모든 정책값과 전후 오차를 job evidence에 남긴다.

Q4는 **첫 검색부터 시간·거리 선호를 보조 추천에 반영**한다. 공통 모델의 평균 비교 확률 차이가 0.08 이내인 후보만 대상으로 축별 최대 0.04 보너스를 주며, 다른 조건의 차이와 문항 간 부담 개선량 차이만큼 영향력을 줄인다. 두 사례 모두 수용/거절한 축만 사용하고 판단 보류·엇갈린 응답·Q2 무선택은 중립이다. 수용 응답도 부담이 실제로 줄고 관찰한 증가 비율 안에 있는 후보에만 적용한다. 이는 검증된 허용 계수나 학습 효과가 아닌 실험 정책이다.

`q4Policy.js`가 해석·추천, `q4Profile.service.js`가 저장·설정·재설문을 담당한다. X8·공통 모델·행동 학습 건수는 바꾸지 않는다. 검색 snapshot에 기본 추천/최종 추천/정책 근거를 함께 보존하며 실제 선택 내보내기의 Q4 정보도 학습 입력이 아닌 메타데이터다. MY에서 반영을 끄거나 다시 설문할 수 있다. 재설문은 Q2를 유지하고 행동 보정을 초기화하지만 과거 응답·검색·선택은 보존한다. 이전 문항에 품질 정보가 없으면 재설문 전까지 중립이다.

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

`database/bootstrap.py`는 baseline 01~05와 최신 migration 세 개를 조합한다. 기존 테이블이 있으면 거부하며 한 트랜잭션으로 적용한다. PostGIS를 준비하고 과거 pgRouting/위험도 seed는 설치하지 않는다. 도로는 위 ZIP 복원으로 준비한다. 별도로 운영하던 기존 DB에는 `.\.venv\Scripts\python.exe -X utf8 database/manage.py q4`로 Q4 migration을 적용한다. 현재 공유 DB에는 이미 반영했다.

```powershell
# 새 프로젝트의 backend/.env 및 두 프론트 .env 설정 후
.\.venv\Scripts\python.exe -X utf8 database/manage.py bootstrap
npm run test:local
.\.venv\Scripts\python.exe -X utf8 database/manage.py activate
npm run doctor -- --db
```

최초 관리자만: 서비스 회원가입·이메일 확인 후 Auth의 해당 사용자 UUID로 `database/manage.py init-admin --user-id <UUID>`를 Python으로 실행한다. 관리자가 이미 있으면 거부하며 이후 권한 변경은 관리자 화면에서 한다. 소셜 공급자, 이메일 인증 및 localhost 리다이렉트 설정은 Supabase/카카오/네이버 콘솔에서 별도로 맞춘다. 키·비밀번호는 Git에 넣지 않는다.

### 이번 재현성 보완과 확인

- `scripts/doctor.mjs`: 앱 설정·프로젝트 일치·공개 설정의 비밀키 혼입·Python·데이터 해시·원격 39개 테이블의 RLS/권한·활성 모델 해시 확인. `npm run doctor -- --db`로 실행한다.
- `scripts/test-bootstrap.py`: 실제 PostGIS의 격리 스키마에서 신규 구성·가입·설문·첫 관리자·재실행 거부를 검사하고 전부 롤백한다. 현재 원격 데이터를 초기화하지 않는다.
- `scripts/start-local.mjs`: 포트 중복/범위 검증, worker와 API 준비 후 화면 서버 실행.
- Git 대상 파일만 별도 복사해 `npm ci`, 계약/비교 검사, 두 화면 빌드 통과. `.env`·Python·도로 데이터 누락도 감지했다. 실행 검증 스크립트는 Git에 포함하고 `.test-tools` 결과는 제외한다.

확장 우선순위는 **실제 선택 자료로 모델·Q4 보조 정책 평가 → 다양한 서울 OD의 경로 품질·제한시간 회귀 검사 → 동시 요청 대기열/취소**다. Q4를 학습된 시간·거리 계수로 확대하려면 별도 학습·검증이 필요하다.

### 관리자 시안 반영

청록색 사이드바·통계 카드·표·상세창을 통일했다. 대시보드는 한국 시간 기준 오늘/이번 달/올해의 저장된 검색을 실제 DB count로 집계한다(30초 캐시). 데이터·모델 상세와 최근 50건 기록의 검색/상태 필터/10건 페이지 이동, 관리자 이메일 검색·권한 변경 확인창을 추가했다. 공지는 비공개 초안 또는 공개 상태로 저장할 수 있다. 정상 문의 UUID가 거부되던 검증식을 수정했다. 기존 DB 구조를 그대로 사용하며 추가 migration은 없다. `test-admin-usage.mjs`와 관리자 Chrome 검사 18개(임시 비공개 공지·테스트 문의 답변 포함)를 통과했다.

모바일은 최상위 프레임과 본문이 동시에 움직이던 중첩 스크롤을 제거하고, 화면별 본문 하나만 터치 스크롤하도록 통일했다. 390×430 화면에서 온보딩 설문·선택 경로·마이페이지·운전 부담 설정·도움말·긴 약관의 실제 스크롤 이동을 포함한 사용자 Chrome 검사 28개를 통과했다.

경로 비교 설문은 실제 후보를 추가 계산해 24문항을 재선정했다. `q4Cases.json`이 실행 자료이며 후보 수집 캐시는 실행에 필요하지 않다. 카드에는 시간·거리·해당 부담값만 표시하고, 다른 조건은 펼침 표로 확인한다. A/B 지도 색상·선 모양도 구분했다. 기존 세션과 응답은 보존하며 새 설문부터 적용한다. 후속 Q4 보조 정책에는 위 migration이 필요하고 공통 모델은 유지한다. `npm test`(Q4 정책 검사 포함), `scripts/test-q4-data.py`(46개 경로 재검산), `node scripts/test-ui.mjs --q4-only`로 검증한다. 선정 기준은 문항 편집용이며, 단일 요인 실험이나 안전성 검증을 뜻하지 않는다.
