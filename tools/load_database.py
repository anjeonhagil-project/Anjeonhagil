"""Load a new immutable release into PostgreSQL with COPY; validate before activation."""
from pathlib import Path
import argparse,sqlite3,json,hashlib,os,sys
from shapely import from_wkb
from shapely.geometry import mapping
from shapely.ops import transform
from pyproj import Transformer
ROOT=Path(__file__).resolve().parent.parent
RELEASE='anjeon_final_20260915_child100_v3'
TABLES={
'ag_nodes':'release_id,node_id,x_5186,y_5186,longitude,latitude',
'ag_edges':'release_id,edge_id,osm_way_id,length_m,road_name,highway,narrow_score,narrow_basis,narrow_estimated,child_nearby,child_inside_length_m,child_inside_intervals,geometry_geojson,attributes',
'ag_arcs':'release_id,arc_id,edge_id,from_node,to_node,length_m,static_eligible,merge_score,merge_basis,merge_estimated,fallback_kph,fallback_basis',
'ag_topis_links':'release_id,topis_link_id,road_name,from_to,source_length_m,identity_status,geometry_geojson',
'ag_hourly_profiles':'release_id,topis_link_id,weekend,hour,n_days,median_kph,p10_kph,p90_kph',
'ag_arc_speed_mapping':'release_id,arc_id,topis_link_id,matched,reason,max_distance_m,mean_distance_m,max_angle_deg,source_fraction_start,source_fraction_end',
'ag_transitions':'release_id,from_arc,to_arc,via_node,complex_proxy,unfamiliar_proxy,is_allowed,attributes',
'ag_restrictions':'release_id,relation_id,kind,arc_ids'}
def ro(p):
 c=sqlite3.connect('file:'+str(p.resolve())+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;return c
def gp(b):return from_wkb(b[8+{0:0,1:32,2:48,3:48,4:64}[(b[3]>>1)&7]:])
def rows(table,root=ROOT):
 rt=ro(root/'data/routing.sqlite');policy=ro(root/'data/feature_policy.sqlite');clock=ro(root/'data/hourly_speed.sqlite');tr=Transformer.from_crs(5186,4326,always_xy=True)
 try:
  if table=='ag_nodes':
   for r in rt.execute('select * from nodes order by node_id'):yield [RELEASE,r['node_id'],r['x_5186'],r['y_5186'],*tr.transform(r['x_5186'],r['y_5186'])]
  elif table=='ag_edges':
   road=ro(root/'data/roads.gpkg');circles=ro(root/'data/child_circle.sqlite');ci={r['edge_id']:dict(r) for r in circles.execute('select edge_id,inside_circle_length_m,intervals_json from edge_child_circle')};circles.close();ep={r['edge_id']:dict(r) for r in policy.execute('select * from edge_policy')}
   for r in road.execute('select * from road_edges order by edge_id'):
    p=ep[r['edge_id']];attrs={k:r[k] for k in r.keys() if k not in ['fid','geom']};attrs.update(p)
    yield [RELEASE,r['edge_id'],r['osm_way_id'],r['length_m'],r['name'],r['highway'],p['narrow_score'],p['basis'],bool(p['is_estimated']),bool(p['child_nearby']),ci[r['edge_id']]['inside_circle_length_m'],json.loads(ci[r['edge_id']]['intervals_json']),mapping(transform(tr.transform,gp(r['geom']))),attrs]
   road.close()
  elif table=='ag_arcs':
   ap={r['arc_id']:dict(r) for r in policy.execute('select * from arc_policy')};eligible={r['arc_id']:bool(r['static_eligible']) for r in clock.execute('select arc_id,static_eligible from arc_mapping')}
   for r in rt.execute('select * from arcs order by arc_id'):
    p=ap[r['arc_id']];yield [RELEASE,r['arc_id'],r['edge_id'],r['from_node'],r['to_node'],r['length_m'],eligible[r['arc_id']],p['merge_score'],p['merge_basis'],bool(p['merge_estimated']),p['eta_dev_kph'],p['eta_basis']]
  elif table=='ag_topis_links':
   geos={f['properties']['LINK_ID']:f['geometry'] for f in json.loads((root/'evidence/topis_links_live.geojson').read_text())['features']}
   for r in clock.execute('select * from source_identity order by topis_link_id'):yield [RELEASE,r['topis_link_id'],r['road_name'],r['from_to'],r['source_length_m'],r['status'],geos[r['topis_link_id']]]
  elif table=='ag_hourly_profiles':
   for r in clock.execute('select * from hourly_profile order by topis_link_id,weekend,hour'):yield [RELEASE,r['topis_link_id'],r['weekend'],r['hour'],r['n_days'],r['median_kph'],r['p10_kph'],r['p90_kph']]
  elif table=='ag_arc_speed_mapping':
   for r in clock.execute('select * from arc_mapping order by arc_id'):yield [RELEASE,r['arc_id'],r['topis_link_id'],bool(r['matched']),r['reason'],r['max_distance_m'],r['mean_distance_m'],r['max_angle_deg'],r['source_fraction_start'],r['source_fraction_end']]
  elif table=='ag_transitions':
   turns=ro(root/'data/transitions.sqlite');excluded={tuple(x['arc_ids']) for x in json.loads((root/'tools/runtime/routing_policy.json').read_text())['transitions']};allowed={r['arc_id'] for r in clock.execute('select arc_id from arc_mapping where static_eligible=1')}
   for r in turns.execute('select * from transition_proxy order by from_arc,to_arc'):yield [RELEASE,r['from_arc'],r['to_arc'],r['via_node'],r['complex_proxy'],r['unfamiliar_proxy'],r['from_arc'] in allowed and r['to_arc'] in allowed and (r['from_arc'],r['to_arc']) not in excluded,dict(r)]
   turns.close()
  elif table=='ag_restrictions':
   for r in rt.execute('select * from restriction_sequences order by relation_id,arc_ids_json'):yield [RELEASE,r['relation_id'],r['kind'],json.loads(r['arc_ids_json'])]
  else:raise ValueError('unknown table')
 finally:rt.close();policy.close();clock.close()
def expected_counts():
 rt=ro(ROOT/'data/routing.sqlite');clock=ro(ROOT/'data/hourly_speed.sqlite');turns=ro(ROOT/'data/transitions.sqlite');road=ro(ROOT/'data/roads.gpkg')
 return {t:c.execute('select count(*) from '+s).fetchone()[0] for t,c,s in [('ag_nodes',rt,'nodes'),('ag_edges',road,'road_edges'),('ag_arcs',rt,'arcs'),('ag_topis_links',clock,'source_identity'),('ag_hourly_profiles',clock,'hourly_profile'),('ag_arc_speed_mapping',clock,'arc_mapping'),('ag_transitions',turns,'transition_proxy'),('ag_restrictions',rt,'restriction_sequences')]}
def versions():return json.loads((ROOT/'final_release.json').read_text())['versions']
def verify_files():
 m=json.loads((ROOT/'service_manifest.json').read_text())
 for name,h in m['files'].items():
  p=(ROOT/name).resolve()
  if not p.is_relative_to(ROOT.resolve()):raise ValueError('invalid manifest path')
  with p.open('rb') as f:actual=hashlib.file_digest(f,'sha256').hexdigest()
  if actual!=h:raise ValueError('file hash mismatch: '+name)
 return m
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--load',action='store_true');ap.add_argument('--activate',action='store_true');ap.add_argument('--dry-run',action='store_true');ap.add_argument('--report');args=ap.parse_args()
 if args.activate and not args.load:ap.error('--activate requires --load')
 manifest=verify_files();expected=expected_counts()
 if not args.load:
  report={}
  for table in TABLES:
   digest=hashlib.sha256();n=0
   for row in rows(table):digest.update(json.dumps(row,ensure_ascii=False,sort_keys=True,allow_nan=False,separators=(',',':')).encode());n+=1
   if n!=expected[table]:raise ValueError('count mismatch: '+table)
   report[table]={'rows':n,'logical_rows_sha256':digest.hexdigest()};print(table,n,flush=True)
  result={'release_id':RELEASE,'dry_run':report}
  if args.report:Path(args.report).write_text(json.dumps(result,ensure_ascii=False,indent=2))
  print(json.dumps(result,ensure_ascii=False,indent=2));sys.exit(0)
 import psycopg
 from psycopg.types.json import Jsonb
 dsn=os.environ.get('DATABASE_URL')
 if not dsn:raise SystemExit('Set DATABASE_URL locally; do not paste it into a shared report.')
 with psycopg.connect(dsn) as db:
  with db.cursor() as cur:
   cur.execute('SELECT pg_advisory_xact_lock(hashtext(%s))',(RELEASE,))
   cur.execute('select manifest,status from public.ag_dataset_releases where release_id=%s',(RELEASE,));existing=cur.fetchone()
   if existing:
    if existing[0]!=manifest or existing[1]!='ready':raise ValueError('existing release differs or is incomplete; use a new release id')
   else:
    v=versions();cur.execute('insert into public.ag_dataset_releases(release_id,dataset_version,contract_version,feature_version,eta_version,routing_policy_version,manifest,expected_counts) values(%s,%s,%s,%s,%s,%s,%s,%s)',(RELEASE,v['dataset_version'],v['contract_version'],v['feature_version'],v['eta_version'],v['routing_policy_version'],Jsonb(manifest),Jsonb(expected)))
    for table,columns in TABLES.items():
     n=0
     with cur.copy('COPY public.'+table+' ('+columns+') FROM STDIN') as copy:
      for row in rows(table):copy.write_row([Jsonb(x) if isinstance(x,(list,dict)) else x for x in row]);n+=1
     if n!=expected[table]:raise ValueError('source count mismatch')
     print(table,n,flush=True)
   for table,want in expected.items():
    cur.execute('select count(*) from public.'+table+' where release_id=%s',(RELEASE,))
    if cur.fetchone()[0]!=want:raise ValueError('loaded count mismatch '+table)
   cur.execute("update public.ag_dataset_releases set status='ready' where release_id=%s",(RELEASE,))
   if args.activate:cur.execute('insert into public.ag_dataset_active(singleton,release_id) values(true,%s) on conflict(singleton) do update set release_id=excluded.release_id,activated_at=now()',(RELEASE,))
 print(json.dumps({'loaded':True,'activated':args.activate,'release_id':RELEASE,'counts':expected},ensure_ascii=False))
