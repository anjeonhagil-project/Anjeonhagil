/*
===============================================================================
안전하길 DB FINAL
00_extensions.sql
===============================================================================
[기능]
- 공간 데이터 처리를 위한 PostGIS 활성화
- 도로 네트워크 경로 탐색을 위한 pgRouting 활성화
- Supabase 권장 방식에 맞춰 extensions 스키마를 사용

[실행 시점]
- 가장 먼저 1회 실행
- 01_schema.sql 보다 반드시 먼저 실행

[주의]
- 실제 turn-aware 경로 탐색 함수는 설치된 pgRouting 버전에 맞춰 Backend에서 선택
- 이 파일은 경로 계산 쿼리 자체를 만들지 않고 Extension만 준비
===============================================================================
*/

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS postgis
WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS pgrouting
WITH SCHEMA extensions;

-- 확인
SELECT
    e.extname,
    e.extversion,
    n.nspname AS installed_schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname IN ('postgis', 'pgrouting')
ORDER BY e.extname;
