# Anjeonhagil 계산기

`Anjeonhagil_FINAL_CHILD100_20260915 (1).zip`에서 현재 계산에 필요한 부분만 가져왔다. 기존 Express API와 화면에는 아직 연결하지 않았다. 전체 작업 안내는 [변경 및 개발 안내](../../../docs/ANJEON_CHANGES.md)를 참조한다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `data/roads.gpkg` | EPSG:5186 물리 도로 geometry와 원래 방향 |
| `data/routing.sqlite` | node, 방향 arc, 회전 제한 시퀀스 |
| `data/transitions.sqlite` | 진입 arc → 진출 arc의 회전 부담 |
| `data/feature_policy.sqlite` | 채택한 좁음/합류/속도 규칙과 근거 |
| `data/hourly_speed.sqlite` | 방향 매칭·평일/주말·24시간 TOPIS 속도와 fallback |
| `data/child_circle.sqlite` | 시설 중심 100m 원 합집합 내부의 edge 비율 구간 |
| `data/support/features.sqlite`, `graph.sqlite` | 현 계산기가 내부적으로 참조하는 기반 값. 파일명에 support가 있어도 필수 |
| `data/seoul_boundary.gpkg` | 추가 반입한 EPSG:5186 서울 경계. 서비스 영역 검사 구현 시 사용하며 1km 버퍼와 구분 |
| `tools/serve.py` | `127.0.0.1:8100` 내부 HTTP worker. 별도 프로세스로 실행 |
| `tools/api.py`, `calculate.py` | 현재 버전으로 고정 경로를 계산하는 Python 진입점/CLI |
| `tools/verify_dataset.py` | 로컬 선별 manifest 검사 |
| `tools/runtime/routing_service.py` | 방향 edge 스냅, 시간대 A*, Q3 후보 필터, 경로 geometry |
| `tools/runtime/hourly.py` | 시간 경계별 속도 적분·coverage |
| `tools/runtime/child_feature.py` | 6번째 부담을 실제 원 내부 통과길이로 교체하는 현행 계산 |
| `tools/runtime/learning.py` | 실제 표시/선택 snapshot을 X8/Y로 변환. 학습모델 자체는 아님 |
| `tools/runtime/search_engine.py`, `features.py`, `runtime.py`, `interface.py` | 현 계산기의 내부 의존성. `interface.py`를 현행 공개 API로 직접 사용하지 않음 |
| `tools/runtime/rules.json`, `routing_policy.json`, `data_manifest.json` | 내부 정적 데이터와 묶인 정책/해시. 옛 버전 문자열을 임의로 변경하지 않음 |
| `tools/runtime/current_feature_contract.json`, `final_release.json` | 현행 6개 요소·단위·버전 |
| `tools/examples/*.json` | 실제 좌표/부분 arc 호출 예시. 사용자 선택 학습 정답이 아님 |
| `service_manifest.json` | 선별 반입본의 실행 파일/데이터 해시 |
| `IMPORT_MANIFEST.json` | 원본/로컬 해시와 수정 여부. JSON은 주석을 지원하지 않아 이 문서에서 역할 설명 |
| `source_register.json` | 제공 자료의 출처·기준일·갱신·표시 계약 |

## 실행

프로젝트 루트에서 실행한다. Python 3.12가 필요하다. 기존 Python과 `venv`는 정상이며, 프로젝트 계산/DB용 `.venv`도 구성했다. Windows에서는 UTF-8 모드(`python -X utf8`)로 실행한다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r apps/backend/routing/requirements.txt
node scripts/verify-routing-data.mjs
.\.venv\Scripts\python.exe apps/backend/routing/tools/calculate.py
.\.venv\Scripts\python.exe apps/backend/routing/tools/serve.py
```

계산 데이터 8개와 서울 경계 1개는 현재 PC에 복사했으며 대용량이므로 Git에서 제외했다. 다른 PC에서는 전달 ZIP으로 복원한다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-routing-data.ps1 -ArchivePath 'C:\path\Anjeonhagil_FINAL_CHILD100_20260915 (1).zip'
node scripts/verify-routing-data.mjs
```

외부 인터페이스에 worker를 노출해야 하면 `ROUTING_WORKER_HOST`와 `ROUTING_WORKER_TOKEN`을 서버 환경에 설정한다. 브라우저는 Express만 호출한다. 전달본 기록상 worker 대기 메모리는 약 1.59GiB이며 이번 PC에서 새로 측정한 값은 아니다.

도로 그래프의 Supabase 미러는 만들지 않는다. 첨부 `manage_database.py`, `load_database.py`, `database/*.sql`은 이 구조와 호환되지 않으므로 실행하지 않는다. DB의 거리/arc/원 내부길이 공간 검산 대신 계산기가 검증한 결과와 동결 파일 해시를 신뢰하는 방식이다. 따라서 백엔드는 브라우저가 보낸 후보/피처로 `ag_save_search`를 호출해서는 안 된다.

## 반입본과 원본 차이

- `tools/api.py`: 전체 DB 적재 모듈의 해시검사 import를 독립 `verify_dataset.py`로 변경했다.
- `tools/runtime/search_engine.py`: 첫 줄에 기능 설명만 추가했다.
- `service_manifest.json`: 현재 필요한 파일만 남기고 로컬 변경 후 해시를 기록했다. 원본 해시는 `IMPORT_MANIFEST.json`에 보존했다.
- 계산식·데이터·내부 `data_manifest.json`·정책값은 변경하지 않았다. 나머지 Python 파일은 원본 첫 줄 docstring으로 역할을 설명한다.

Python 파일을 수정하면 로컬 manifest 해시도 검토 후 갱신해야 한다. 값/의미가 달라지는 변경은 기존 release ID를 재사용하지 않는다. Git의 자동 CRLF 변환으로 해시가 깨지지 않도록 이 폴더에는 `.gitattributes`가 적용된다.
