"""Apply additive schema, report state or switch existing ready release. Uses private DATABASE_URL."""
from pathlib import Path
import argparse,os,json,re
import psycopg
ROOT=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('action',choices=['migrate','status','activate']);a.add_argument('--release-id');args=a.parse_args()
dsn=os.environ.get('DATABASE_URL')
if not dsn:raise SystemExit('DATABASE_URL is required in your local environment.')
with psycopg.connect(dsn) as db:
 with db.cursor() as c:
  if args.action=='migrate':
   c.execute("select to_regclass('public.users')")
   if c.fetchone()[0] is None:raise SystemExit('Apply the existing service baseline first; users table is required.')
   c.execute("select column_name,data_type from information_schema.columns where table_schema='public' and table_name='users'");columns=dict(c.fetchall())
   if columns.get('id')!='uuid' or columns.get('onboarding')!='boolean':raise SystemExit('Existing users schema differs; expected UUID id and boolean onboarding.')
   c.execute("select to_regclass('public.ag_dataset_releases')")
   if c.fetchone()[0] is not None:raise SystemExit('ag_ schema already exists; do not reapply or overwrite. Use status, then versioned migration if needed.')
   for name in ['01_additive_schema.sql','02_transactions.sql']:
    text=(ROOT/'database'/name).read_text().strip()
    # Execute both files atomically in this outer transaction.
    text=re.sub(r'(?m)^BEGIN;\s*$', '', text, count=1)
    if text.endswith('COMMIT;'):text=text[:-7]
    c.execute(text)
   print('Additive schema installed; existing legacy tables preserved.')
  elif args.action=='activate':
   if not args.release_id:raise SystemExit('--release-id required')
   c.execute('select status,expected_counts from public.ag_dataset_releases where release_id=%s',(args.release_id,));row=c.fetchone()
   if not row or row[0]!='ready':raise SystemExit('Only a ready release can be activated.')
   allowed={'ag_nodes','ag_edges','ag_arcs','ag_topis_links','ag_hourly_profiles','ag_arc_speed_mapping','ag_transitions','ag_restrictions'}
   if set(row[1])!=allowed:raise SystemExit('Invalid expected_counts contract')
   for table,n in row[1].items():
    c.execute('select count(*) from public.'+table+' where release_id=%s',(args.release_id,))
    if c.fetchone()[0]!=n:raise SystemExit('Incomplete release: '+table)
   c.execute('insert into public.ag_dataset_active(singleton,release_id) values(true,%s) on conflict(singleton) do update set release_id=excluded.release_id,activated_at=now()',(args.release_id,))
   print('Activated '+args.release_id+'; restart the matching worker/backend release before serving.')
  else:
   c.execute('select release_id,status,expected_counts from public.ag_dataset_releases order by created_at');print(json.dumps(c.fetchall(),ensure_ascii=False,default=str,indent=2))
   c.execute('select release_id from public.ag_dataset_active');print('active:',c.fetchall())
