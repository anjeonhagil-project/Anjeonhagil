"""Independent spatial bounds for every edge; current partial/reverse arc arithmetic.

An inscribed polygon is inside the mathematical circle, and its scaled circumscribed
polygon contains the circle. Thus their route intersection lengths bracket the exact
answer without reusing the analytic circle-line builder. No source DB is changed.
"""
from pathlib import Path
import argparse,json,math,sqlite3,sys
from types import SimpleNamespace
from shapely import Point,STRtree,from_wkb,union_all
from shapely.ops import substring
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/runtime'))
from child_feature import TeamCalculator

def geometry(blob):return from_wkb(blob[8+{0:0,1:32,2:48,3:48,4:64}[(blob[3]>>1)&7]:])
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--report',default='child100_validation.local.json');args=ap.parse_args()
 c=sqlite3.connect('file:'+str(ROOT/'data/child_circle.sqlite')+'?mode=ro',uri=True)
 rows={eid:(n,flag,length,json.loads(intervals)) for eid,n,flag,length,intervals in c.execute('select * from edge_child_circle')}
 points=[Point(x,y) for x,y in c.execute('select distinct x_5186,y_5186 from facility_point')];c.close();tree=STRtree(points)
 q=128;radius_outer=100/math.cos(math.pi/(4*q))
 lower=[p.buffer(100,quad_segs=q) for p in points];upper=[p.buffer(radius_outer,quad_segs=q) for p in points]
 calc=SimpleNamespace(intervals={eid:r[3] for eid,r in rows.items()})
 r=sqlite3.connect('file:'+str(ROOT/'data/roads.gpkg')+'?mode=ro',uri=True)
 report={'all_passed':False,'road_edges_checked':0,'inside_edges':0,'facility_unique_locations':len(points),'polygon_sides':4*q,'method':'inscribed/circumscribed polygon bounds independent of analytic circle builder','partial_geometry_checks':0,'reverse_checks':0,'split_additivity_checks':0,'max_geometry_bracket_width_m':0.,'max_partial_bracket_width_m':0.,'max_length_field_error_m':0.}
 seen=set();positive_index=0
 for eid,length,b in r.execute('select edge_id,length_m,geom from road_edges order by edge_id'):
  seen.add(eid);n,flag,inside,iv=rows[eid];g=geometry(b);report['road_edges_checked']+=1
  assert math.isfinite(length) and length>0 and abs(g.length-length)<1e-6,(eid,'geometry_length')
  report['max_length_field_error_m']=max(report['max_length_field_error_m'],abs(g.length-length))
  previous=-1.
  for a,z in iv:
   assert 0<=a<z<=1 and a>previous,(eid,'intervals_not_disjoint_sorted');previous=z
  assert abs(inside-length*sum(z-a for a,z in iv))<1e-6 and -1e-8<=inside<=length+1e-6,(eid,'stored_length')
  ids=tree.query(g,predicate='dwithin',distance=100)
  assert bool(len(ids))==bool(flag),(eid,'nearby_point_flag')
  assert bool(inside>0)==bool(iv),(eid,'interval_presence')
  if len(ids):
   low=union_all([lower[int(i)] for i in ids]);high=union_all([upper[int(i)] for i in ids])
   a=g.intersection(low).length;z=g.intersection(high).length
   assert a-1e-6<=inside<=z+1e-6,(eid,'outside_independent_spatial_bounds',a,inside,z)
   report['max_geometry_bracket_width_m']=max(report['max_geometry_bracket_width_m'],z-a)
  if inside>0:
   report['inside_edges']+=1;positive_index+=1
   # Spatially distributed deterministic sample plus every multi-interval edge.
   if positive_index%19==0 or len(iv)>1:
    for lo,hi in [(0.,.25),(.25,.75),(.75,1.),(.1,.9)]:
     value=TeamCalculator.child_length(calc,2*eid,lo,hi,length)
     reverse=TeamCalculator.child_length(calc,2*eid+1,1-hi,1-lo,length)
     piece=substring(g,lo,hi,normalized=True);a=piece.intersection(low).length;z=piece.intersection(high).length
     assert a-1e-6<=value<=z+1e-6,(eid,'partial_geometry',lo,hi,a,value,z)
     assert abs(value-reverse)<1e-8,(eid,'reverse')
     mid=(lo+hi)/2
     split=TeamCalculator.child_length(calc,2*eid,lo,mid,length)+TeamCalculator.child_length(calc,2*eid,mid,hi,length)
     assert abs(value-split)<1e-8,(eid,'split')
     report['partial_geometry_checks']+=1;report['reverse_checks']+=1;report['split_additivity_checks']+=1
     report['max_partial_bracket_width_m']=max(report['max_partial_bracket_width_m'],z-a)
  if report['road_edges_checked']%100000==0:print('spatial edges checked',report['road_edges_checked'],file=sys.stderr,flush=True)
 assert set(rows)==seen
 r.close()
 # Direction/fraction contract: every arc length and parity agrees with the original edge.
 a=sqlite3.connect('file:'+str(ROOT/'data/routing.sqlite')+'?mode=ro',uri=True)
 a.execute('attach database ? as roads',(str(ROOT/'data/roads.gpkg'),))
 mismatches=a.execute('select count(*) from arcs a left join roads.road_edges e on e.edge_id=a.edge_id where e.edge_id is null or a.arc_id/2<>a.edge_id or abs(a.length_m-e.length_m)>0.000001 or (a.arc_id%2=0 and (a.from_node<>e.from_node or a.to_node<>e.to_node)) or (a.arc_id%2=1 and (a.from_node<>e.to_node or a.to_node<>e.from_node))').fetchone()[0]
 assert mismatches==0
 report['arc_direction_rows_checked']=a.execute('select count(*) from arcs').fetchone()[0];a.close()
 # Simple exact examples: full 200m edge, only 40m inside; half outside; boundary contact.
 fake=SimpleNamespace(intervals={1:[[.4,.6]],2:[]})
 tests=[(2,0,1,40),(2,0,.25,0),(2,0,.5,20),(3,.5,1,20),(4,0,1,0)]
 for aid,lo,hi,want in tests:assert abs(TeamCalculator.child_length(fake,aid,lo,hi,200)-want)<1e-9
 report['known_exact_examples']=len(tests);report['all_passed']=True
 Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
