# 실제 PostGIS에서 전체 신규 구성을 격리 스키마에 실행하고 무조건 롤백한다. public/auth의 실데이터는 변경하지 않는다.
import json
import re
import sys
from pathlib import Path
from uuid import uuid4
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'database'))
from bootstrap import bootstrap_sql
from manage import connect, initialize_admin

schema='agtest_'+uuid4().hex
auth_schema=schema+'_auth'
sql=bootstrap_sql(include_extensions=False)
sql=re.sub(r'(?im)^\s*(?:BEGIN|COMMIT);\s*$','',sql)
sql=re.sub(r'\bpublic\b',schema,sql)
sql=re.sub(r'\bauth\.',auth_schema+'.',sql)
# NOTIFY도 검증 트랜잭션의 rollback과 함께 버려진다.
passed=0
with connect() as db:
    try:
        db.execute('BEGIN')
        db.execute(f'CREATE SCHEMA {schema}; CREATE SCHEMA {auth_schema}')
        db.execute(f"CREATE TABLE {auth_schema}.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{{}}',raw_app_meta_data jsonb DEFAULT '{{}}',email_confirmed_at timestamptz)")
        db.execute(sql)
        assert db.execute('SELECT count(*) n FROM pg_tables WHERE schemaname=%s',[schema]).fetchone()['n']==42
        passed+=1
        assert db.execute('SELECT count(*) n FROM pg_tables WHERE schemaname=%s AND NOT rowsecurity',[schema]).fetchone()['n']==0
        passed+=1
        user=str(uuid4())
        db.execute(f"INSERT INTO {auth_schema}.users(id,email,raw_app_meta_data) VALUES(%s,'bootstrap@example.test','{{\"provider\":\"google\"}}')",[user])
        assert db.execute(f'SELECT count(*) n FROM {schema}.users WHERE id=%s',[user]).fetchone()['n']==1
        passed+=1
        pref=db.execute(f"SELECT {schema}.ag_save_preferences(%s,'weekly','[1,0,2,0,0,0]',NULL) p",[user]).fetchone()['p']
        assert pref['profile_version']
        passed+=1
        assert db.execute(f'SELECT count(*) n FROM {schema}.ag_model_versions WHERE is_active').fetchone()['n']==1
        passed+=1
        initialize_admin(db,user)
        assert db.execute(f"SELECT role FROM {schema}.admins WHERE id=%s",[user]).fetchone()['role']=='super_admin'
        passed+=1
        try:
            initialize_admin(db,user)
            raise AssertionError('Second initial administrator was accepted')
        except ValueError:
            passed+=1
        # 재실행 시 기존 테이블을 변경하지 않는 차단 조건도 검사한다.
        db.execute('SAVEPOINT guard_test')
        try:
            db.execute(sql)
            raise AssertionError('Bootstrap unexpectedly accepted existing tables')
        except Exception as error:
            if 'EMPTY_DATABASE_REQUIRED' not in str(error): raise
            db.execute('ROLLBACK TO SAVEPOINT guard_test')
            passed+=1
    finally:
        db.execute('ROLLBACK')
    assert db.execute('SELECT count(*) n FROM pg_namespace WHERE nspname IN (%s,%s)',[schema,auth_schema]).fetchone()['n']==0
    passed+=1
print(json.dumps({'passed':passed,'scope':'42-table fresh bootstrap, PostGIS, RLS, auth trigger, preferences, model, Q4 revisions/trial estimates, durable queue, refusal, rollback'}))
