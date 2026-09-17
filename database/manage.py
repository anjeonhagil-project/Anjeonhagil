# 기능(Anjeonhagil): 로컬 .env의 동일 Supabase 프로젝트에 preflight/apply/status/activate를 수행한다. 비밀값은 출력하지 않는다.
# 사용: .venv\Scripts\python.exe -X utf8 database/manage.py preflight|apply|status|activate
# 원본 README의 full-mirror manage_database.py/load_database.py와 병용하지 않는다. 도로 DB는 SQLite에 그대로 둔다.
from pathlib import Path
from urllib.parse import urlparse, unquote, parse_qs
import argparse
import hashlib
import json
import os
import re
import sys
import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'database/migrations/20260916_anjeonhagil_foundation.sql'


def settings():
    values = {}
    env_file = ROOT / 'apps/backend/.env'
    if env_file.is_file():
        for line in env_file.read_text(encoding='utf-8-sig').splitlines():
            if not line.strip() or line.lstrip().startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('\"\'')
    for key in ('DATABASE_URL', 'SUPABASE_URL'):
        if os.environ.get(key):
            values[key] = os.environ[key]
    url = values.get('DATABASE_URL', '')
    if not url:
        raise ValueError('DATABASE_URL is missing from apps/backend/.env or the process environment.')
    target = urlparse(url)
    api = urlparse(values.get('SUPABASE_URL', ''))
    project = (api.hostname or '').split('.')[0]
    if not project or target.scheme not in ('postgres', 'postgresql'):
        raise ValueError('Valid SUPABASE_URL and PostgreSQL DATABASE_URL are required.')
    direct = target.hostname == f'db.{project}.supabase.co'
    pooler = (target.hostname or '').endswith('.pooler.supabase.com') and unquote(target.username or '') == f'postgres.{project}'
    if not (direct or pooler):
        raise ValueError('DATABASE_URL does not match the Supabase project configured for this app.')
    return url, project


def connect():
    url, _ = settings()
    mode = parse_qs(urlparse(url).query).get('sslmode', ['require'])[0]
    if mode not in ('require', 'verify-ca', 'verify-full'):
        mode = 'require'
    return psycopg.connect(url, sslmode=mode, connect_timeout=15, autocommit=True, row_factory=dict_row)


def preflight(db):
    results = []
    with db.cursor() as cur:
        cur.execute((ROOT / 'database/20260916_preflight.sql').read_text(encoding='utf-8'))
        while True:
            if cur.description:
                results.append(cur.fetchall())
            if not cur.nextset():
                break
    dest = ROOT / '.test-tools/supabase-preflight.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(results, ensure_ascii=False, default=str, indent=2), encoding='utf-8')
    return {'result_sets': len(results), 'saved': '.test-tools/supabase-preflight.json'}


def status(db):
    tables = db.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ag\\_%' ESCAPE '\\' ORDER BY tablename").fetchall()
    out = {'tables': [r['tablename'] for r in tables], 'table_count': len(tables)}
    core=re.findall(r'CREATE TABLE public\.(\w+)',(ROOT/'database/baseline/01_schema.sql').read_text(encoding='utf-8'))
    expected=core+out['tables']
    present=db.execute("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename=ANY(%s)",[expected]).fetchall()
    out['missing_core_tables']=sorted(set(core)-{r['tablename'] for r in present})
    out['rls_disabled']=[r['tablename'] for r in present if not r['rowsecurity']]
    out['browser_table_access']=db.execute("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(%s) AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))",[expected]).fetchall()
    out['missing_service_read']=db.execute("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(%s) AND NOT has_table_privilege('service_role',c.oid,'SELECT')",[expected]).fetchall()
    if any(r['tablename'] == 'ag_dataset_releases' for r in tables):
        out['releases'] = db.execute('SELECT release_id,status FROM ag_dataset_releases ORDER BY created_at').fetchall()
        out['active_release'] = db.execute('SELECT release_id FROM ag_dataset_active').fetchall()
        out['active_model'] = db.execute('SELECT model_version FROM ag_model_versions WHERE is_active').fetchall()
        manifest=json.loads((ROOT/'apps/backend/routing/service_manifest.json').read_text(encoding='utf-8'))
        active=db.execute('SELECT r.* FROM ag_dataset_active a JOIN ag_dataset_releases r USING(release_id)').fetchone()
        model=db.execute('SELECT model_version,artifact_sha256 FROM ag_model_versions WHERE is_active').fetchone()
        local_model=ROOT/'ml/bundled/logistic.json'
        out['local_release_matches']=bool(active and active['status']=='ready' and active['manifest']==manifest)
        out['local_model_matches']=bool(model and model['artifact_sha256']==hashlib.sha256(local_model.read_bytes()).hexdigest())
        out['unvalidated_constraints'] = db.execute("SELECT conname FROM pg_constraint WHERE conrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname LIKE 'ag\\_%' ESCAPE '\\') AND NOT convalidated").fetchall()
    return out


def initialize_admin(db, user_id):
    # 첫 관리자만 로컬 DB 소유자가 지정한다. 이후 권한 관리는 관리자 화면에서 수행한다.
    from uuid import UUID
    user_id=str(UUID(user_id))
    with db.transaction():
        db.execute('LOCK TABLE admins IN EXCLUSIVE MODE')
        if db.execute('SELECT 1 FROM admins LIMIT 1').fetchone():
            raise ValueError('An administrator already exists. Use the administrator screen.')
        user=db.execute('SELECT id,email FROM users WHERE id=%s AND is_active',[user_id]).fetchone()
        if not user:
            raise ValueError('An active, registered service user is required.')
        db.execute("INSERT INTO admins(id,email,role) VALUES(%s,%s,'super_admin')",[user_id,user['email']])
        db.execute("INSERT INTO admin_audit_logs(actor_admin_id,target_admin_id,action,after_data) VALUES(%s,%s,'create_admin','{\"role\":\"super_admin\",\"source\":\"initial_setup\"}')",[user_id,user_id])


def activate(db):
    # 실제 worker 검사와 같은 파일/버전만 ready로 전환한다. 고정 데이터의 값/ID는 변경하지 않는다.
    routing = ROOT / 'apps/backend/routing'
    manifest_bytes = (routing / 'service_manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    report = json.loads((ROOT / '.test-tools/service-routing-report.json').read_text(encoding='utf-8'))
    runtime_bytes=(routing/'runtime_manifest.json').read_bytes()
    runtime=json.loads(runtime_bytes)
    if report.get('passed', 0) < 15 or report.get('manifest_sha256') != hashlib.sha256(manifest_bytes).hexdigest() or report.get('runtime_sha256')!=hashlib.sha256(runtime_bytes).hexdigest():
        raise ValueError('A successful smoke test for this exact manifest is required before activation.')
    for name, expected in {**{k:v for k,v in manifest['files'].items() if not k.endswith('.py')},**runtime['files']}.items():
        file = (routing / name).resolve()
        if not file.is_relative_to(routing.resolve()):
            raise ValueError('Invalid manifest path.')
        with file.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != expected:
                raise ValueError('Runtime file hash mismatch; activation cancelled.')
    with db.transaction():
        row = db.execute('SELECT * FROM ag_dataset_releases WHERE release_id=%s FOR UPDATE', [manifest['release_id']]).fetchone()
        if not row or row['manifest'] != manifest or any(row[key] != value for key, value in report['versions'].items()):
            raise ValueError('Remote release and tested worker do not match.')
        db.execute("UPDATE ag_dataset_releases SET status='ready' WHERE release_id=%s", [manifest['release_id']])
        db.execute('INSERT INTO ag_dataset_active(singleton,release_id) VALUES(true,%s) ON CONFLICT(singleton) DO UPDATE SET release_id=excluded.release_id,activated_at=now()', [manifest['release_id']])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['preflight', 'apply', 'status', 'activate', 'integrate', 'q4', 'flow', 'bootstrap', 'init-admin'])
    parser.add_argument('--user-id',help='init-admin: UUID of an already registered service user')
    args = parser.parse_args()
    _, project = settings()
    with connect() as db:
        out = {'project': project, 'command': args.command}
        if args.command == 'init-admin':
            if not args.user_id: raise ValueError('--user-id is required for init-admin.')
            initialize_admin(db,args.user_id)
            out['created']=True
        if args.command == 'bootstrap':
            from bootstrap import bootstrap_sql
            try:
                db.execute(bootstrap_sql())
            except Exception:
                db.execute('ROLLBACK')
                raise
        if args.command in ('preflight', 'apply'):
            out['preflight'] = preflight(db)
        if args.command == 'apply':
            if db.execute("SELECT to_regclass('public.ag_q4_sessions') AS name").fetchone()['name']:
                raise ValueError('Integration schema already exists. Use integrate; applying the old foundation would replace current functions.')
            # SQL 자체의 transaction/호환성 검사에 실패하면 부분 변경을 남기지 않는다.
            try:
                db.execute(MIGRATION.read_text(encoding='utf-8'))
            except Exception:
                db.execute('ROLLBACK')
                raise
        if args.command == 'integrate':
            try:
                db.execute((ROOT/'database/migrations/20260916_service_integration.sql').read_text(encoding='utf-8'))
                db.execute((ROOT/'database/migrations/20260917_q4_personalization.sql').read_text(encoding='utf-8'))
                db.execute((ROOT/'database/migrations/20260917_service_flow.sql').read_text(encoding='utf-8'))
            except Exception:
                db.execute('ROLLBACK')
                raise
        if args.command == 'flow':
            db.execute((ROOT/'database/migrations/20260917_service_flow.sql').read_text(encoding='utf-8'))
        if args.command == 'activate':
            activate(db)
        if args.command == 'q4':
            try:
                db.execute((ROOT/'database/migrations/20260917_q4_personalization.sql').read_text(encoding='utf-8'))
            except Exception:
                db.execute('ROLLBACK')
                raise
        if args.command in ('status', 'apply', 'activate', 'integrate', 'bootstrap','q4'):
            out['status'] = status(db)
        print(json.dumps(out, ensure_ascii=False, default=str, indent=2))


if __name__ == '__main__':
    try:
        main()
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
    except psycopg.Error as exc:
        print(f'Database operation failed: {type(exc).__name__}; SQLSTATE={exc.sqlstate or "unavailable"}. No credentials were printed.', file=sys.stderr)
        sys.exit(1)
