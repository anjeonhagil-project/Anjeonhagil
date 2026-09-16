"""Current raw6: CHILD_ZONE_NEARBY is exact path length inside the union of facility-centred 100 m circles."""
from pathlib import Path
import sqlite3,json
from interface import TeamCalculator as LegacyCalculator, FACTOR_ORDER, UNITS
FEATURE_VERSION='static_burden_v5_child_circle_inside'
class TeamCalculator:
 def __init__(self):
  self.legacy=LegacyCalculator()
  root=Path(__file__).resolve().parents[2]
  c=sqlite3.connect('file:'+str(root/'data/child_circle.sqlite')+'?mode=ro',uri=True)
  self.intervals={eid:json.loads(value) for eid,value in c.execute("select edge_id,intervals_json from edge_child_circle where inside_circle_length_m>0")};c.close()
 def child_length(self,arc_id,start_fraction=0.,end_fraction=1.,arc_length_m=None):
  if arc_length_m is None:arc_length_m=self.legacy.engine.rt.execute('select length_m from arcs where arc_id=?',(arc_id,)).fetchone()[0]
  lo,hi=start_fraction,end_fraction
  if arc_id%2:lo,hi=1-hi,1-lo
  return arc_length_m*sum(max(0.,min(hi,b)-max(lo,a)) for a,b in self.intervals.get(arc_id//2,()))
 def evaluate(self,request):
  value=self.legacy.evaluate(request);inside=sum(self.child_length(s['arc_id'],s.get('start_fraction',0.),s.get('end_fraction',1.)) for s in request['segments'])
  legacy_nearby=value['raw_features'][5]
  value['raw_features'][5]=inside;value['feature_version']=FEATURE_VERSION
  value['quality'].update(child_circle_inside_m=inside,child_feature_method='facility_point_100m_circle_union_intersection_length_v2',legacy_child_nearby_edge_length_m=legacy_nearby)
  return value
