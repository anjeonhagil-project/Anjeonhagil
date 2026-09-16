from pathlib import Path
import sqlite3,json,re,math,collections,hashlib
from datetime import datetime,timezone
from shapely import from_wkb,STRtree,Point
from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Transformer
import argparse
ap=argparse.ArgumentParser();ap.add_argument('--output',required=True);args=ap.parse_args()
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(args.output).resolve()
if OUT.exists():raise SystemExit('Output exists; choose a new path to preserve the release.')
OUT.parent.mkdir(parents=True,exist_ok=True)
def ro(p):
 c=sqlite3.connect('file:'+str(p.resolve())+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;return c
def norm(s):return re.sub(r'[\s()\-·]','',str(s or ''))
def gp(b):return from_wkb(b[8+{0:0,1:32,2:48,3:48,4:64}[(b[3]>>1)&7]:])
source=ro(ROOT/'evidence/topis_profiles_source.sqlite');src={r['topis_link_id']:dict(r) for r in source.execute('select * from source_link')}
live=json.loads((ROOT/'evidence/topis_links_live.geojson').read_text());tr=Transformer.from_crs(4326,5186,always_xy=True)
geo=[];met=[];identity=[]
for f in sorted(live['features'],key=lambda f:f['properties']['LINK_ID']):
 p=f['properties'];lid=p['LINK_ID'];s=src.get(lid)
 if not s:continue
 reasons=[]
 if norm(p['AXIS_NAME'])!=norm(s['road_name']):reasons.append('SOURCE_ROAD_NAME_CHANGED')
 if abs(p['DIST']-s['length_m'])>max(20,.15*s['length_m']):reasons.append('SOURCE_EXTENT_CHANGED')
 if norm(p['S_ENAME'])!=norm(s['from_name']+'~'+s['to_name']):reasons.append('SOURCE_ENDPOINT_NAMES_CHANGED')
 g=transform(tr.transform,shape(f['geometry']))
 if g.geom_type!='LineString' or g.length<=0:reasons.append('SOURCE_GEOMETRY_INVALID')
 identity.append((lid,'ACCEPTED' if not reasons else '|'.join(reasons),p['AXIS_NAME'],p['S_ENAME'],p['DIST'],g.length))
 if reasons:continue
 geo.append(g);met.append(dict(id=lid,name=norm(s['road_name']),length=g.length))
tree=STRtree(geo)
c=sqlite3.connect(OUT);c.executescript('''
CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE source_identity(topis_link_id TEXT PRIMARY KEY,status TEXT,road_name TEXT,from_to TEXT,source_length_m REAL,geometry_length_m REAL);
CREATE TABLE arc_mapping(arc_id INTEGER PRIMARY KEY,edge_id INTEGER NOT NULL,topis_link_id TEXT,matched INTEGER NOT NULL,reason TEXT NOT NULL,max_distance_m REAL,mean_distance_m REAL,max_angle_deg REAL,source_fraction_start REAL,source_fraction_end REAL,length_m REAL NOT NULL,fallback_kph REAL,fallback_basis TEXT NOT NULL,static_eligible INTEGER NOT NULL);
CREATE TABLE hourly_profile(topis_link_id TEXT NOT NULL,weekend INTEGER NOT NULL,hour INTEGER NOT NULL,n_days INTEGER NOT NULL,median_kph REAL,p10_kph REAL,p90_kph REAL,profile_version TEXT NOT NULL,PRIMARY KEY(topis_link_id,weekend,hour));
CREATE INDEX arc_mapping_source ON arc_mapping(topis_link_id);
''');c.executemany('insert into source_identity values(?,?,?,?,?,?)',identity)
c.executemany('insert into hourly_profile values(?,?,?,?,?,?,?,?)',[(r['topis_link_id'],r['weekend'],r['hour_bin_index'],r['n_days'],r['median_kph'],r['p10_kph'],r['p90_kph'],r['profile_version']) for r in source.execute('select * from historical_speed_profile')])
roads=ro(ROOT/'data/roads.gpkg');arc=ro(ROOT/'data/routing.sqlite');policy=ro(ROOT/'data/feature_policy.sqlite');byedge=collections.defaultdict(list)
for r in arc.execute('select * from arcs'):byedge[r['edge_id']].append(dict(r))
ap={r['arc_id']:dict(r) for r in policy.execute('select * from arc_policy')};ep={r['edge_id']:dict(r) for r in policy.execute('select edge_id,eligible,narrow_score from edge_policy')}
counts=collections.Counter();lengths=collections.Counter();batch=[];examples=[]
for idx,r in enumerate(roads.execute('select edge_id,geom,from_node,name,highway,length_m from road_edges')):
 g=gp(r['geom']);near=list(tree.query(g,predicate='dwithin',distance=12)) if norm(r['name']) else []
 namec=[int(i) for i in near if met[int(i)]['name']==norm(r['name'])]
 for a in byedge[r['edge_id']]:
  aid=a['arc_id'];p=ap[aid];eligible=bool(a['static_eligible'] and p['eligible'] and ep[r['edge_id']]['eligible'] and ep[r['edge_id']]['narrow_score'] is not None and p['merge_score'] is not None)
  ok=[];reason='NO_SOURCE_GEOMETRY_NEARBY';best_fail=None
  if not eligible:reason='OUTSIDE_SUPPORTED_GRAPH'
  elif not norm(r['name']):reason='OSM_ROAD_NAME_MISSING'
  elif not near:reason='NO_SOURCE_GEOMETRY_NEARBY'
  elif not namec:reason='ROAD_NAME_MISMATCH'
  elif g.length<3:reason='ARC_TOO_SHORT_FOR_DIRECTION'
  else:
   reason='DIRECTION_OR_GEOMETRY_MISMATCH'
   n=max(2,int(math.ceil(g.length/10))+1);fractions=[j/(n-1) for j in range(n)]
   if a['from_node']!=r['from_node']:fractions=fractions[::-1]
   pts=[g.interpolate(f,normalized=True) for f in fractions]
   for i in namec:
    line=geo[i];dist=[pt.distance(line) for pt in pts];maxd=max(dist);mean=sum(dist)/len(dist)
    if maxd>12 or mean>8:continue
    pro=[line.project(pt) for pt in pts]
    if pro[-1]-pro[0]<g.length*.8:continue
    angles=[]
    for j in range(len(pts)-1):
     dx=pts[j+1].x-pts[j].x;dy=pts[j+1].y-pts[j].y;v=(pro[j]+pro[j+1])/2
     q0=line.interpolate(max(0,v-2));q1=line.interpolate(min(line.length,v+2));tx=q1.x-q0.x;ty=q1.y-q0.y
     if math.hypot(dx,dy)==0 or math.hypot(tx,ty)==0:continue
     cos=max(-1,min(1,(dx*tx+dy*ty)/(math.hypot(dx,dy)*math.hypot(tx,ty))))
     angles.append(math.degrees(math.acos(cos)))
    if not angles or max(angles)>25:continue
    ok.append((mean,maxd,max(angles),met[i]['id'],pro[0]/line.length,pro[-1]/line.length))
   ok.sort()
   if len(ok)>1 and ok[1][0]-ok[0][0]<3:reason='AMBIGUOUS_PARALLEL_LINK';ok=[]
   elif ok:reason='MATCHED_GEOMETRY_NAME_DIRECTION'
  found=ok[0] if ok else None
  batch.append((aid,r['edge_id'],found[3] if found else None,int(bool(found)),reason,found[1] if found else None,found[0] if found else None,found[2] if found else None,found[4] if found else None,found[5] if found else None,a['length_m'],p['eta_dev_kph'],p['eta_basis'],int(eligible)))
  counts[reason]+=1;lengths[reason]+=a['length_m']
  if found and len(examples)<20:examples.append(dict(arc_id=aid,topis_link_id=found[3],road_name=r['name'],max_distance_m=found[1],max_angle_deg=found[2]))
 if len(batch)>10000:c.executemany('insert into arc_mapping values('+','.join(['?']*14)+')',batch);batch=[]
 if idx%100000==0:print('roads',idx,'mapped',counts['MATCHED_GEOMETRY_NAME_DIRECTION'],flush=True)
if batch:c.executemany('insert into arc_mapping values('+','.join(['?']*14)+')',batch)
parameters={'max_distance_m':12,'mean_distance_m':8,'max_angle_deg':25,'ambiguity_mean_distance_margin_m':3,'min_arc_length_m':3,'source_projection_coverage_min':.8,'source_length_tolerance_max_m_or_ratio':[20,.15],'name_match':'exact after whitespace/punctuation normalization','source_direction':'ordered WFS geometry; source from/to labels must agree with historical metadata','sampling_spacing_max_m':10}
for k,v in {'eta_version':'internal_hourly_topis_v1','timezone':'Asia/Seoul','clock_rule':'~01 = [00:00,01:00), ... ~24 = [23:00,24:00), project-adopted interpretation of original end-hour labels','day_rule':'Monday-Friday weekday; Saturday-Sunday weekend; holidays not separately modeled','profile_period':'2026-08-01 through 2026-08-24; historical estimates, not live traffic','mapping_parameters':json.dumps(parameters,ensure_ascii=False),'geometry_sha256':hashlib.sha256((ROOT/'evidence/topis_links_live.geojson').read_bytes()).hexdigest(),'profile_source_sha256':hashlib.sha256((ROOT/'evidence/topis_profiles_source.sqlite').read_bytes()).hexdigest(),'runtime_speed':'positive finite median with n_days>=3, bounded at 130 kph; missing profile uses static explicit fallback','time_integration':'piecewise hourly speed, consume distance across hour boundaries; FIFO'}.items():c.execute('insert into metadata values(?,?)',(k,v))
c.commit();eligible_length=c.execute('select sum(length_m) from arc_mapping where static_eligible=1').fetchone()[0];matched_length=c.execute('select sum(length_m) from arc_mapping where matched=1').fetchone()[0]
summary={'source_links_total':len(src),'source_identity_accepted':len(geo),'identity_status':dict(collections.Counter(x[1] for x in identity)),'arc_counts':dict(counts),'arc_length_m_by_reason':dict(lengths),'supported_arc_length_m':eligible_length,'matched_arc_length_m':matched_length,'matched_directional_length_ratio':matched_length/eligible_length,'matched_source_links':c.execute('select count(distinct topis_link_id) from arc_mapping where matched=1').fetchone()[0],'sample':examples,'parameters':parameters}
OUT.with_suffix('.summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in summary.items() if k not in ['sample','parameters']},ensure_ascii=False),flush=True);c.execute('VACUUM');c.close()
