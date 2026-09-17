"""실제 DB 이력과 분리된 합성 예제로 행동 보정의 채택·보류·불변 조건을 검사한다."""
from pathlib import Path
from datetime import datetime,timedelta,timezone
import sys,json,copy,math
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'ml/src'))
from inference import ChoiceModel
from personalize import adapt
model=ChoiceModel();now=datetime.now(timezone.utc)
version={k:model.spec[k] for k in ['feature_version','contract_version','eta_version']}
a={**version,'display_duration_s':300,'internal_duration_s':300,'distance_m':1500,'raw_features':[2,0,100,0,0,0]}
b={**a,'raw_features':[0,0,1500,0,0,0]}
request={'as_of':now.isoformat(),'survey_weights':[.8,0,.2,0,0,0],'current_weights':[.8,0,.2,0,0,0],
    'searches':[{'sample_origin':'service','chosen_at':(now-timedelta(hours=i)).isoformat(),'candidates':[a,b],'selected_index':0} for i in range(20)]}
before=copy.deepcopy(request);result=adapt(model,request)
assert request==before
assert result['accepted'] and result['after_loss']<result['before_loss']
assert math.isclose(sum(result['weights']),1,abs_tol=1e-9)
assert all(result['weights'][i]==0 for i in [1,3,4,5])
assert 0<result['evidence']['alpha']<1
few=copy.deepcopy(request);few['searches']=few['searches'][:3]
assert adapt(model,few)['reason']=='INSUFFICIENT_ACTUAL_CHOICES'
nine=copy.deepcopy(request);nine['searches']=nine['searches'][:9]
assert adapt(model,nine)['evidence']['window_days']==30
assert adapt(model,nine)['reason']!='INSUFFICIENT_ACTUAL_CHOICES'
four=copy.deepcopy(request);four['searches']=four['searches'][:4]
assert adapt(model,four)['evidence']['training_searches']==2
assert adapt(model,four)['evidence']['validation_searches']==2
identical=copy.deepcopy(request)
for row in identical['searches']:row['candidates']=[a,copy.deepcopy(a)]
assert adapt(model,identical)['reason']=='NO_PREFERENCE_VARIATION'
q4=copy.deepcopy(request)
for r in q4['searches']:r['sample_origin']='onboarding'
assert adapt(model,q4)['reason']=='INSUFFICIENT_ACTUAL_CHOICES'
none=copy.deepcopy(request);none['survey_weights']=[0]*6;none['current_weights']=[0]*6
assert adapt(model,none)['reason']=='AT_LEAST_TWO_PREFERENCES_REQUIRED'
for invalid in ([.5,0,.5,0,0,.1],[-.1,0,1.1,0,0,0],[.5,.1,.4,0,0,0]):
    bad=copy.deepcopy(request);bad['current_weights']=invalid
    try:adapt(model,bad);raise AssertionError('invalid profile accepted')
    except ValueError as error:assert str(error)=='INVALID_PROFILE'
old=copy.deepcopy(request)
for r in old['searches']:r['chosen_at']=(now-timedelta(days=31)).isoformat()
assert adapt(model,old)['reason']=='INSUFFICIENT_ACTUAL_CHOICES'
report={'passed':17,'scope':'synthetic regression fixtures only','adoption_result':result}
(ROOT/'.test-tools/personalization-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
