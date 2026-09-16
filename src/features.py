"""Nullable route feature adapter for the unified development v1 rule set.
Caller must validate full time/vehicle/restriction history before recommending.
"""
import sqlite3,math,json
from pathlib import Path
ORDER=['COMPLEX_INTERSECTION','MERGE_BRANCH','NARROW_ROAD','UNFAMILIAR_TURN','CONSECUTIVE_ACTION','CHILD_ZONE_NEARBY']
def connect(path):
 c=sqlite3.connect('file:'+str(path)+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;return c
class FeatureCalculator:
 def __init__(self,features,transitions,graph):self.f=connect(features);self.t=connect(transitions);self.g=connect(graph);self.params=json.loads((Path(__file__).resolve().parent.parent/"config.json").read_text())["development_parameters"]
 def calculate(self,segments):
  if not segments:raise ValueError('empty route')
  total=0.;child=0.;narrow=0.;merge=0.;nu=0.;mu=0.;complex_count=0;turn_count=0;actions=[];previous=None
  for i,s in enumerate(segments):
   aid=s['arc_id'];lo=s.get('start_fraction',0.);hi=s.get('end_fraction',1.)
   if not 0<=lo<hi<=1 or i>0 and lo!=0 or i<len(segments)-1 and hi!=1:raise ValueError('partial only first/last segment')
   a=self.g.execute('select * from arcs where arc_id=?',(aid,)).fetchone()
   if not a:raise ValueError('unknown arc')
   e=self.f.execute('select * from edge_feature where edge_id=?',(a['edge_id'],)).fetchone();d=self.f.execute('select * from arc_feature where arc_id=?',(aid,)).fetchone()
   if not e or not d:raise ValueError('missing attributes')
   used=a['length_m']*(hi-lo);child+=used*e['child_nearby']
   if e['narrow_score'] is None:nu+=used
   else:narrow+=used*e['narrow_score']
   if d['merge_multilane'] is None:mu+=used
   else:merge+=used*d['merge_multilane']
   if previous is not None:
    if previous['to_node']!=a['from_node']:raise ValueError('disconnected arcs')
    tr=self.t.execute('select * from transition_proxy where from_arc=? and to_arc=?',(previous['arc_id'],aid)).fetchone()
    if not tr:raise ValueError('not in static transition inventory')
    complex_count+=int(tr['node_degree']>=self.params['complex_node_degree_min']);turn_count+=int((tr['node_degree']>=3 or previous['osm_way_id']!=a['osm_way_id']) and tr['abs_turn_angle_deg']>=self.params['turn_angle_min_deg'])
    eligible=tr['node_degree']>=3 or previous['osm_way_id']!=a['osm_way_id']
    if eligible and (tr['abs_turn_angle_deg']>=self.params['action_angle_min_deg'] or a['highway'].endswith('_link') or previous['highway'].endswith('_link')):actions.append(total)
   total+=used;previous=a
  con=sum(0<b-a<=self.params["consecutive_max_distance_m"] for a,b in zip(actions,actions[1:]))
  return {'factor_order':ORDER,'raw_features':[complex_count,None if mu else merge,None if nu else narrow,turn_count,con,child],'distance_m':total,'unknown_merge_length_m':mu,'unknown_narrow_length_m':nu,'known_merge_length_m':merge,'known_narrow_score_length_m':narrow,'feature_version':'development_v1','eligible_for_model_training':False,'permission':'CALLER_MUST_CHECK_ALL_CONSTRAINTS','quality_review_required':any(s['arc_id'] in {716016,716017} for s in segments)}
