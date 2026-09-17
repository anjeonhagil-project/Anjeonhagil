# Anjeonhagil 내부 계산기

Express와 사용자 화면에 연결된 실제 경로 계산기다. 전체 실행은 저장소 루트의 `npm start`, 팀 공유 안내는 [ANJEON_CHANGES.md](../../../docs/ANJEON_CHANGES.md)를 참고한다.

- `tools/serve.py`: 루프백 HTTP worker. 브라우저는 인증된 Express만 호출한다.
- `runtime/integrated_service.py`: Q3 없이 A*/Yen 후보를 검산하고 1~3개 대표 경로·공통 모델 추천을 반환한다.
- `runtime/routing_service.py`: 방향 스냅·시간대 A*·geometry·검산 기반. 파일 내부의 예전 search 메서드는 현재 worker의 서비스 진입점이 아니다.
- `runtime/search_engine.py/yen.py`: 회전 제한 상태를 유지하는 팀 알고리즘.
- `runtime/child_feature.py/hourly.py`: 실제 원 내부 길이와 시간대별 ETA 계산.
- `service_manifest.json`: 반입 당시 출처/해시 보존. 현재 실행 Python은 `runtime_manifest.json`으로 별도 검증한다.
- `IMPORT_MANIFEST.json` 및 원본 계약 JSON: 반입 출처 기록이다. 내부 과거 식별자를 최신 이름으로 치환하지 않는다.
- `data/`: 필수 도로/회전/정책/시간대/어린이 원/support/서울 경계 SQLite·GPKG 9개. 전부 필요하고 Git에서는 제외한다.

원본 ZIP 복원은 `scripts/import-routing-data.ps1`, 현재 파일 검사는 `node scripts/verify-routing-data.mjs`다. 코드 수정 뒤 `node scripts/build-runtime-manifest.mjs`와 `npm run test:local`을 실행한다. `.gitattributes`가 해시 대상의 원본 바이트를 보존한다.

원본 ZIP의 full-mirror DB 적재 도구와 현재 Supabase migration을 혼용하지 않는다. 경로 데이터는 백엔드에 두고, Supabase에는 버전·사용자·설문·경로 snapshot·노출·선택·개인화 이력을 저장한다.
