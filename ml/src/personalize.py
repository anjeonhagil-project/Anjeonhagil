# 고정 공통 모델에서 행동 가중치를 적합하고 최근 검증 구간이 개선될 때만 설문과 혼합한다.
# 입력: 설문 원본, 과거 실제 선택 snapshot, 고정 model/scaler, 현재 프로필. 출력: 후보 가중치, 전후 loss, 채택/유지 사유.
# 상관없음 항목은 0 고정, 나머지 비음수·합 1 유지. 과거 보정/최근 검증/미래 평가를 나누고 무조건 변경하지 않는다.

import math
import json
from pathlib import Path
from datetime import datetime
import numpy as np
from scipy.optimize import minimize

# 발표용 실험 정책. 실제 사용자에 최적화된 상수가 아니며 모든 갱신 evidence에 보존한다.
POLICY=json.loads((Path(__file__).resolve().parents[1]/'personalization_policy.json').read_text())

def adapt(model, request):
    survey=np.array(request['survey_weights'],dtype=float)
    current=np.array(request['current_weights'],dtype=float)
    if survey.shape!=(6,) or current.shape!=(6,) or np.any(survey<0) or np.any(current<0) or not np.isfinite(survey).all() or not np.isfinite(current).all():raise ValueError('INVALID_PROFILE')
    if not all(math.isclose(float(w.sum()),1.,abs_tol=1e-8) or np.all(w==0) for w in (survey,current)) or np.any(current[survey==0]!=0):raise ValueError('INVALID_PROFILE')
    selected=np.flatnonzero(survey>0)
    evidence={'policy':POLICY,'alpha':0.,'n_eff':0.,'behavior_weights':None,'real_user_validated':False}
    def hold(reason):return {'accepted':False,'reason':reason,'evidence':evidence}
    if not model.available:return hold('MODEL_UNAVAILABLE')
    if len(selected)<2:return hold('AT_LEAST_TWO_PREFERENCES_REQUIRED')
    now=datetime.fromisoformat(request['as_of'].replace('Z','+00:00'))
    rows=[]
    for record in request['searches']:
        if record.get('sample_origin')!='service':continue
        age=(now-datetime.fromisoformat(record['chosen_at'].replace('Z','+00:00'))).total_seconds()/86400
        if not 0<=age<=30:continue
        candidates=record['candidates'];chosen=record['selected_index']
        if not 2<=len(candidates)<=3 or not 0<=chosen<len(candidates):continue
        for c in candidates:
            for key in ('feature_version','contract_version','eta_version'):
                if c.get(key)!=model.spec[key]:raise ValueError('PERSONALIZATION_VERSION_MISMATCH')
        differences=np.array([model.pair(candidates[chosen],c,[1]*6) for i,c in enumerate(candidates) if i!=chosen])
        rows.append({'age':age,'x':differences,'weight':.5**(age/POLICY['half_life_days'])})
    rows.sort(key=lambda r:r['age'])
    recent=[r for r in rows if r['age']<=7]
    rows=(recent if len(recent)>=POLICY['window_switch_searches'] else rows)[:POLICY['maximum_searches']]
    evidence.update(search_count=len(rows),window_days=7 if len(recent)>=POLICY['window_switch_searches'] else 30)
    if len(rows)<POLICY['minimum_searches']:return hold('INSUFFICIENT_ACTUAL_CHOICES')
    # 오래된 80%로 적합하고 최근 20%는 개선 여부 판정에만 사용한다.
    validation=rows[:max(2,math.ceil(len(rows)*.2))];training=rows[len(validation):]
    evidence.update(training_searches=len(training),validation_searches=len(validation))
    if len(training)<2 or len(validation)<2:return hold('INSUFFICIENT_VALIDATION_CHOICES')
    beta=np.array(model.spec['coefficients'])/np.array(model.spec['scales'])
    informative=lambda data:any(np.ptp(r['x'][:,2+selected]*beta[2+selected],axis=1).max()>1e-10 for r in data)
    if not informative(training):return hold('NO_PREFERENCE_VARIATION')
    if not informative(validation):return hold('INSUFFICIENT_VALIDATION_VARIATION')
    def losses(weights, data):
        weights8=np.r_[1.,1.,weights]
        return np.array([np.logaddexp(0,-(r['x']*weights8@beta)).mean() for r in data])
    def full(v):
        out=np.zeros(6);out[selected]=v;return out
    def objective(v):
        w=full(v)
        return float(np.average(losses(w,training),weights=[r['weight'] for r in training])+POLICY['regularization']*np.sum((w-survey)**2))
    fitted=minimize(objective,survey[selected],method='SLSQP',bounds=[(0,1)]*len(selected),constraints=[{'type':'eq','fun':lambda v:sum(v)-1}],options={'maxiter':100,'ftol':1e-10})
    if not fitted.success:return hold('OPTIMIZER_DID_NOT_CONVERGE')
    behavior=full(np.clip(fitted.x,0,1));behavior/=behavior.sum()
    consistency=float(np.mean([float(np.mean(r['x']*np.r_[1.,1.,behavior]@beta)>0) for r in training]))
    n_eff=sum(r['weight'] for r in rows)*consistency
    alpha=n_eff/(n_eff+POLICY['blend_k'])
    effective=(1-alpha)*survey+alpha*behavior
    before=float(np.mean(losses(current,validation)));after=float(np.mean(losses(effective,validation)))
    evidence.update(alpha=alpha,n_eff=n_eff,consistency=consistency,behavior_weights=behavior.tolist(),training_searches=len(training),validation_searches=len(validation),validation_scope='chronological_holdout_not_future_test')
    return {'accepted':after<before-POLICY['minimum_validation_improvement'],'reason':'VALIDATION_IMPROVED' if after<before-POLICY['minimum_validation_improvement'] else 'NO_VALID_IMPROVEMENT',
        'weights':effective.tolist(),'before_loss':before,'after_loss':after,'evidence':evidence}
