# 신규 Supabase 전용: 원본 baseline과 최신 migration을 한 트랜잭션으로 조합한다. 기존 DB에는 실행을 거부한다.
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def bootstrap_sql(include_extensions=True):
    guard = """
DO $$ BEGIN
 IF to_regclass('auth.users') IS NULL THEN RAISE EXCEPTION 'SUPABASE_AUTH_REQUIRED'; END IF;
 IF EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
 ) THEN RAISE EXCEPTION 'EMPTY_DATABASE_REQUIRED: existing objects are preserved'; END IF;
END $$;
"""
    extension = "CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;" if include_extensions else ''
    files = [ROOT/'baseline'/name for name in ('01_schema.sql','02_indexes.sql','03_triggers.sql','04_maintenance.sql','05_security.sql')]
    files += [ROOT/'migrations/20260916_anjeonhagil_foundation.sql', ROOT/'migrations/20260916_service_integration.sql', ROOT/'migrations/20260917_q4_personalization.sql']
    files += [ROOT/'migrations/20260917_service_flow.sql']
    # 파일별 BEGIN/COMMIT만 제거한다. PL/pgSQL BEGIN 및 실제 SQL은 그대로 유지한다.
    chunks = [re.sub(r'(?im)^\s*(?:BEGIN|COMMIT);\s*$', '', file.read_text(encoding='utf-8')) for file in files]
    # baseline의 기존 서비스 CRUD 권한만 명시한다. ag_* 쓰기는 해당 migration의 RPC 권한을 유지한다.
    names = re.findall(r'CREATE TABLE public\.(\w+)', files[0].read_text(encoding='utf-8'))
    grants = 'GRANT USAGE ON SCHEMA public TO service_role; GRANT ALL ON TABLE '+','.join('public.'+name for name in names)+' TO service_role; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;'
    return '\n'.join(['BEGIN;', "SET LOCAL lock_timeout='5s';", guard, extension, *chunks, grants, "NOTIFY pgrst, 'reload schema';", 'COMMIT;'])


if __name__ == '__main__':
    # SQL Editor를 사용할 경우 파일로 저장한다. 접속/적용하지 않는다.
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    dest=Path(args.output)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(bootstrap_sql(),encoding='utf-8')
    print('Fresh Supabase bootstrap SQL generated. Existing databases will be refused.')
