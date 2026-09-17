"""Stable team boundary. Read public views or call evaluate; do not import review tables."""
import math,json,hashlib,sqlite3
from pathlib import Path
from runtime import Calculator
CONTRACT='anjeon_contract_v4';DATASET='seoul_static_20260915_review2';FEATURE='static_burden_v4'
ETA='internal_static_v2_provenance';POLICY_VERSION='review_exclusion_v1'
VERSIONS=dict(contract_version=CONTRACT,dataset_version=DATASET,feature_version=FEATURE,eta_version=ETA,routing_policy_version=POLICY_VERSION)
FACTOR_ORDER=['COMPLEX_INTERSECTION','MERGE_BRANCH','NARROW_ROAD','UNFAMILIAR_TURN','CONSECUTIVE_ACTION','CHILD_ZONE_NEARBY']
UNITS=['count','score*m','score*m','count','count','m']
POLICY_PATH=Path(__file__).resolve().parent/'routing_policy.json'
POLICY=json.loads(POLICY_PATH.read_text())
REVIEW_TURNS={tuple(x['arc_ids']) for x in POLICY['transitions']}
EXPECTED_DATA_MANIFEST_SHA256='72fa3e5b8c839f41ea39ac5ec275909b41147ae289c6261b8c6f38783a76a56c'
def verify_runtime_data(root=None):
 root=Path(root) if root is not None else Path(__file__).resolve().parent.parent.parent
 manifest=root/'tools/runtime/data_manifest.json'
 def digest(p):
  with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
 if not manifest.is_file() or digest(manifest)!=EXPECTED_DATA_MANIFEST_SHA256:raise ValueError('runtime data manifest mismatch')
 for name,expected in json.loads(manifest.read_text()).items():
  p=(root/name).resolve()
  if not p.is_relative_to(root.resolve()) or not p.is_file() or digest(p)!=expected:raise ValueError('runtime data hash mismatch: '+name)
 return True
def number(x):return type(x) in (int,float) and math.isfinite(x)
def versions(obj):
 for key,expected in VERSIONS.items():
  if obj.get(key)!=expected:raise ValueError(key+' mismatch')
def token(obj,key):
 value=obj.get(key)
 if not isinstance(value,str) or not value.strip():raise ValueError(key+' required as nonempty string')
 return value
class TeamCalculator:
 def __init__(self):
  verify_runtime_data()
  self.engine=Calculator()
  circle_path=Path(__file__).resolve().parent.parent.parent/'data/child_circle.sqlite'
  self.circles=sqlite3.connect('file:'+str(circle_path)+'?mode=ro',uri=True)
  versions(dict(self.engine.db.execute('select key,value from metadata')));versions(self.engine.rules)
  if self.engine.rules.get('factor_order')!=FACTOR_ORDER or self.engine.rules.get('units')!=UNITS:raise ValueError('factor schema mismatch')
  stored=self.engine.db.execute("select value from metadata where key='routing_policy_sha256'").fetchone()
  if not stored or stored[0]!=hashlib.sha256(POLICY_PATH.read_bytes()).hexdigest():raise ValueError('routing policy mismatch')
 def evaluate(self,request):
  versions(request)
  if not isinstance(request.get('segments'),list) or not request['segments']:raise ValueError('nonempty segment list required')
  for seg in request['segments']:
   if not isinstance(seg,dict) or type(seg.get('arc_id'))!=int:raise ValueError('integer arc_id required')
   lo,hi=seg.get('start_fraction',0.),seg.get('end_fraction',1.)
   if not number(lo) or not number(hi) or not 0<=lo<hi<=1:raise ValueError('invalid numeric fractions')
  ids=[s['arc_id'] for s in request['segments']]
  if any(x in REVIEW_TURNS for x in zip(ids,ids[1:])):raise ValueError('UNRESOLVED_TRANSITION_EXCLUDED')
  value=self.engine.calculate(request['segments'])
  inside=0.
  for seg in request['segments']:
   aid=seg['arc_id'];lo,hi=seg.get('start_fraction',0.),seg.get('end_fraction',1.)
   if aid%2:lo,hi=1-hi,1-lo
   row=self.circles.execute('select intervals_json from edge_child_circle where edge_id=?',(aid//2,)).fetchone()
   if row is None:raise ValueError('missing child circle geometry')
   length=self.engine.rt.execute('select length_m from arcs where arc_id=?',(aid,)).fetchone()[0]
   inside+=length*sum(max(0.,min(hi,b)-max(lo,a)) for a,b in json.loads(row[0]))
  review=[list(x) for x in zip(ids,ids[1:]) if x in REVIEW_TURNS]
  return {**VERSIONS,'factor_order':value['factor_order'],'units':UNITS.copy(),'raw_features':value['raw_features'],'distance_m':value['distance_m'],'internal_duration_s':value['eta_dev_seconds'],'time_source':'INTERNAL_STATIC','quality':{'eta_source_lengths_m':value['eta_source_lengths_m'],'child_circle_inside_m':inside,'child_circle_method':'facility_100m_euclidean_union_v1','all_six_ready':value['all_six_computable'],'narrow_estimated_length_m':value['narrow_estimated_length_m'],'merge_estimated_length_m':value['merge_estimated_length_m'],'unknown_narrow_length_m':value['unknown_narrow_length_m'],'unknown_merge_length_m':value['unknown_merge_length_m'],'recorded_static_constraints_checked':True,'external_review_turns':review,'routing_policy_version':POLICY_VERSION,'routing_acceptance':'NOT_ASSESSED','production_route_approved':False}}
def survey_weights(ranks):
 if len(ranks)!=6 or any(type(r)!=int or r<0 for r in ranks):raise ValueError('six answered ranks required; unanswered -1 must be resolved')
 chosen=sorted(r for r in ranks if r>0);k=len(chosen)
 if chosen!=list(range(1,k+1)):raise ValueError('ranks must be unique and contiguous')
 return [0. if r==0 else (k-r+1)/(k*(k+1)/2) for r in ranks]
def validate_scaler(scaler):
 import re
 if not isinstance(scaler,dict):raise ValueError('versioned train-only scaler required')
 token(scaler,'scale_version')
 if scaler.get('feature_version')!=FEATURE or scaler.get('fit_split')!='train':raise ValueError('invalid scaler provenance')
 if not re.fullmatch('[0-9a-f]{64}',scaler.get('fit_manifest_sha256','')):raise ValueError('scaler fit manifest SHA256 required')
 scales=scaler.get('values',[])
 if len(scales)!=8 or any(not number(x) or x<=0 for x in scales):raise ValueError('eight positive finite scales required')
 return scales
def scaler_hash(scaler):
 validate_scaler(scaler)
 return hashlib.sha256(json.dumps(scaler,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
def validate_snapshot(obj):
 versions(obj)
 for key in ['candidate_id','search_id','user_id','exposure_id','profile_version','model_version','scale_version','scaler_sha256']:token(obj,key)
 if obj.get('displayed') is not True:raise ValueError('candidate was not displayed')
 if obj.get('factor_order')!=FACTOR_ORDER or obj.get('units')!=UNITS:raise ValueError('factor schema mismatch')
 raw=obj.get('raw_features')
 pw=obj.get('profile_weights')
 if not isinstance(pw,list) or len(pw)!=6 or any(not number(x) or x<0 for x in pw):raise ValueError('invalid profile weights')
 if not isinstance(raw,list) or len(raw)!=6:raise ValueError('six features required')
 if any(not number(x) or x<0 for x in [obj.get('display_duration_s'),obj.get('distance_m')]+raw):raise ValueError('unready display snapshot')
 if obj.get('display_duration_source') not in ['INTERNAL_STATIC','KAKAO_API','NAVER_API']:raise ValueError('display duration source required')
def pair_x8(a,b,weights,scaler):
 scales=validate_scaler(scaler)
 if len(weights)!=6 or any(not number(x) or x<0 for x in weights):raise ValueError('invalid weights')
 if not (math.isclose(sum(weights),1.,rel_tol=1e-9,abs_tol=1e-12) or sum(weights)==0):raise ValueError('weights sum must be zero or one')
 for obj in [a,b]:validate_snapshot(obj)
 if a['candidate_id']==b['candidate_id']:raise ValueError('distinct candidates required')
 for key in ['search_id','user_id','exposure_id','profile_version','model_version','scale_version']:
  if a[key]!=b[key]:raise ValueError(key+' mismatch between snapshots')
 if a['scale_version']!=scaler['scale_version']:raise ValueError('scale_version mismatch')
 if any(obj['scaler_sha256']!=scaler_hash(scaler) for obj in [a,b]):raise ValueError('scaler content mismatch')
 if any(obj.get('profile_weights')!=list(weights) for obj in [a,b]):raise ValueError('profile weights mismatch')
 av=[a['display_duration_s'],a['distance_m']]+a['raw_features'];bv=[b['display_duration_s'],b['distance_m']]+b['raw_features']
 return [(x-y)*w/s for x,y,w,s in zip(av,bv,[1.,1.]+weights,scales)]

def instant(value):
 from datetime import datetime
 if not isinstance(value,str):raise ValueError('timezone-aware timestamp required')
 result=datetime.fromisoformat(value.replace('Z','+00:00'))
 if result.tzinfo is None or result.utcoffset() is None:raise ValueError('timezone-aware timestamp required')
 return result
def make_training_pairs(snapshots,choice,weights,scaler):
 """Validate recorded events. Human authenticity and user-disjoint split need service evidence."""
 if not isinstance(snapshots,list) or len(snapshots)<2:raise ValueError('at least two displayed snapshots required')
 for s in snapshots:validate_snapshot(s)
 by_id={s['candidate_id']:s for s in snapshots}
 if len(by_id)!=len(snapshots):raise ValueError('duplicate candidate IDs')
 if choice.get('event_source')!='ACTUAL_USER_CHOICE':raise ValueError('actual choice event required')
 selected=choice.get('selected_candidate_id')
 if selected not in by_id:raise ValueError('selected candidate not in exposure')
 token(choice,'choice_event_id')
 if choice.get('displayed_candidate_ids')!=[s['candidate_id'] for s in snapshots]:raise ValueError('exposure order/set mismatch')
 for key in ['search_id','user_id','exposure_id']:
  if choice.get(key)!=snapshots[0][key]:raise ValueError(key+' mismatch in choice')
 if instant(choice.get('chosen_at'))<instant(choice.get('exposed_at')):raise ValueError('choice predates exposure')
 rows=[]
 for other in sorted(set(by_id)-{selected}):
  aid,bid=sorted([selected,other]);a,b=by_id[aid],by_id[bid]
  rows.append({'candidate_a':aid,'candidate_b':bid,'search_id':a['search_id'],'user_id':a['user_id'],'exposure_id':a['exposure_id'],'choice_event_id':choice['choice_event_id'],'scale_version':scaler['scale_version'],'X':pair_x8(a,b,weights,scaler),'Y':int(selected==aid),'sample_weight':1/(len(by_id)-1)})
 return rows
