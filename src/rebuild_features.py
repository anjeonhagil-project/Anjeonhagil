"""Rebuild canonical development attributes from bundled inputs; not train-ready labels."""
from pathlib import Path
import sqlite3,json
from shapely import from_wkb,Point,STRtree,union_all
from source_semantics import lanes,width
B=Path(__file__).resolve().parent.parent

def read(p):
 c=sqlite3.connect('file:'+str(p)+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;return c

def geometry(b):return from_wkb(b[8+{0:0,1:32,2:48,3:48,4:64}[(b[3]>>1)&7]:])
roads=read(B/'inputs/roads.gpkg');rows=[dict(r) for r in roads.execute('select * from road_edges')];raw=json.loads((B/'inputs/osm_tags.json').read_text())['ways']
t=read(B/'inputs/taas_points.gpkg');pts=[(str(r[0]),geometry(r[1])) for r in t.execute('select acdnt_no,geom from seoul_taas_2025_points')];tree=STRtree([x[1] for x in pts])
def area(path):
 c=read(path);table,col=c.execute('select table_name,column_name from gpkg_geometry_columns').fetchone();return union_all([geometry(r[0]) for r in c.execute(f'SELECT "{col}" FROM "{table}"')])
seoul=area(B/'inputs/seoul_boundary.gpkg');buffer=area(B/'inputs/seoul_buffer.gpkg');inside50=seoul.buffer(-50)
c=sqlite3.connect(':memory:');c.executescript('CREATE TABLE edge_feature(edge_id INTEGER PRIMARY KEY,child_nearby INTEGER,narrow_score REAL,unknown_narrow INTEGER,observed_width_m REAL,accident_known_count_50m INTEGER,accident_coverage TEXT); CREATE TABLE arc_feature(arc_id INTEGER PRIMARY KEY,edge_id INTEGER,directional_lanes REAL,merge_multilane REAL,quality TEXT); CREATE TABLE accident_overlay(accident_id TEXT PRIMARY KEY,x_5186 REAL,y_5186 REAL,scope TEXT,edge_attribution TEXT);')
for aid,p in pts:c.execute('insert into accident_overlay values(?,?,?,?,?)',(aid,p.x,p.y,'outside_buffer_review' if not buffer.covers(p) else 'seoul' if seoul.covers(p) else 'buffer_context','not_inferred'))
for r in rows:
 t=raw[str(r['osm_way_id'])];g=geometry(r['geom']);w=width(t)['road_width_tag_m'];count=len(tree.query(g,predicate='dwithin',distance=50))
 c.execute('insert into edge_feature values(?,?,?,?,?,?,?)',(r['edge_id'],int(r['child_zone_count_100m']>0),None,1,w,count,'within_seoul_50m_geometry' if inside50.covers(g) else 'boundary_incomplete'))
 for rev in ([False,True] if r['oneway_dir']=='both' else [r['oneway_dir']=='reverse']):
  l=lanes(t,rev,r['oneway_dir']);v=1 if r['highway'].endswith('_link') else l['at_least_3'];c.execute('insert into arc_feature values(?,?,?,?,?)',(2*r['edge_id']+int(rev),r['edge_id'],l['directional_count'],v,'development_rule:'+l['status']))
c.commit();c.execute('pragma integrity_check').fetchone();(B/'data/features.sqlite').write_bytes(c.serialize());print('rebuilt',len(rows),len(pts),flush=True)
