-- 기능: 원격 Supabase의 실제 테이블/컬럼/제약/인증 트리거/권한을 읽기 전용으로 점검한다. 개인정보 행이나 접속 비밀은 조회하지 않는다.
-- SQL Editor에서 전체 실행 후 각 결과 탭을 확인한다. 이 파일은 migration이 아니며 DB를 수정하지 않는다.
BEGIN READ ONLY;

SELECT current_database() AS database_name, version() AS engine_version;

SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
ORDER BY c.relname;

SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND (table_name IN ('users','driving_preferences','route_requests','route_candidates','road_links','road_turns','routing_policies') OR table_name LIKE 'ag\_%' ESCAPE '\')
ORDER BY table_name,ordinal_position;

SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND (c.relname IN ('users','driving_preferences','route_requests','route_candidates','road_links','road_turns') OR c.relname LIKE 'ag\_%' ESCAPE '\')
ORDER BY c.relname,k.conname;

SELECT t.tgname,pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t WHERE t.tgrelid=to_regclass('auth.users') AND NOT t.tgisinternal;
SELECT p.proname,pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p WHERE p.oid=to_regprocedure('public.handle_new_user()');

SELECT grantee,table_name,privilege_type FROM information_schema.table_privileges
WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role')
AND (table_name IN ('users','driving_preferences','route_requests') OR table_name LIKE 'ag\_%' ESCAPE '\')
ORDER BY table_name,grantee,privilege_type;

SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_history_table,
       to_regclass('public.ag_dataset_releases') AS child100_release_table;
-- SQL Editor에서 수동 실행한 SQL은 Supabase CLI migration 기록과 다를 수 있다. 파일 존재/기록만으로 적용 완료로 판단하지 않는다.
COMMIT;
