"""Hourly release learning contract; immutable displayed snapshots, train-only scaling."""
import math,json,hashlib
from interface import FACTOR_ORDER,UNITS,survey_weights
FEATURE='static_burden_v5_child_circle_inside'
VERSIONS=dict(contract_version='anjeon_contract_v6_child100',dataset_version='seoul_static_20260915_review2',feature_version=FEATURE,eta_version='internal_hourly_topis_v1',routing_policy_version='review_exclusion_v1')
def number(x):return type(x) in (int,float) and math.isfinite(x)
def versions(obj):
 for key,expected in VERSIONS.items():
  if obj.get(key)!=expected:raise ValueError(key+' mismatch')
def token(obj,key):
 value=obj.get(key)
 if not isinstance(value,str) or not value.strip():raise ValueError(key+' required as nonempty string')
 return value
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
 instant(obj.get('departure_at'))
 for key in ['candidate_id','search_id','user_id','exposure_id','profile_version','model_version','scale_version','scaler_sha256']:token(obj,key)
 if obj.get('displayed') is not True:raise ValueError('candidate was not displayed')
 if obj.get('factor_order')!=FACTOR_ORDER or obj.get('units')!=UNITS:raise ValueError('factor schema mismatch')
 raw=obj.get('raw_features')
 pw=obj.get('profile_weights')
 if not isinstance(pw,list) or len(pw)!=6 or any(not number(x) or x<0 for x in pw):raise ValueError('invalid profile weights')
 if not isinstance(raw,list) or len(raw)!=6:raise ValueError('six features required')
 if any(not number(x) or x<0 for x in [obj.get('display_duration_s'),obj.get('distance_m')]+raw):raise ValueError('unready display snapshot')
 if obj.get('display_duration_source') not in ['INTERNAL_HOURLY','KAKAO_API','NAVER_API']:raise ValueError('display duration source required')
def pair_x8(a,b,weights,scaler):
 scales=validate_scaler(scaler)
 if len(weights)!=6 or any(not number(x) or x<0 for x in weights):raise ValueError('invalid weights')
 if not (math.isclose(sum(weights),1.,rel_tol=1e-9,abs_tol=1e-12) or sum(weights)==0):raise ValueError('weights sum must be zero or one')
 for obj in [a,b]:validate_snapshot(obj)
 if a['candidate_id']==b['candidate_id']:raise ValueError('distinct candidates required')
 for key in ['search_id','user_id','exposure_id','profile_version','model_version','scale_version','departure_at']:
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
