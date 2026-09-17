"""팀 데이터로 Train scaler·Logistic 계수·Test 450검색·XGBoost 비교·장애 복귀를 재현한다."""
from pathlib import Path
import sys,json,tempfile
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ml/src'))
from inference import ChoiceModel
from logistic_model import load_dataset,make_pipeline,evaluate,FEATURES
model=ChoiceModel()
df,_=load_dataset(ROOT/'ml/data/synthetic_pairwise.csv')
train=df[df.split=='train'];test=df[df.split=='test']
pipeline=make_pipeline(dict(C=100,penalty='l1',solver='liblinear',class_weight='balanced',max_iter=1000),42)
pipeline.fit(train[FEATURES].to_numpy(float),train.y,model__sample_weight=1/train.groupby('search_id').search_id.transform('count').to_numpy(float))
assert np.allclose(pipeline.named_steps['scaler'].scale_,model.spec['scales'],rtol=1e-12)
assert np.allclose(pipeline.named_steps['model'].coef_[0],model.spec['coefficients'],rtol=1e-6)
x=test[FEATURES].to_numpy(float)
expected=pipeline.predict_proba(x)[:,1];actual=np.array([model.probability(v) for v in x])
assert np.max(np.abs(expected-actual))<1e-7
assert max(abs(model.probability(v)+model.probability(-v)-1) for v in x)<1e-12
metrics,_=evaluate(pipeline,test)
for key in ['pair_accuracy','roc_auc','log_loss','top1_accuracy']:
    assert abs(metrics[key]-model.spec['test_metrics'][key])<1e-6,(key,metrics[key])
class XGBAdapter:
    def predict_proba(self,x):
        import xgboost as xgb
        values=model.xgb.predict(xgb.DMatrix(np.asarray(x,dtype=np.float32)/model.xgb_spec['scale'],feature_names=FEATURES))
        return np.column_stack([1-values,values])
xgb_metrics,_=evaluate(XGBAdapter(),test)
with tempfile.TemporaryDirectory(dir=ROOT/'.test-tools') as tmp:
    fallback=ChoiceModel(Path(tmp));assert not fallback.available
    fixture=json.loads((ROOT/'.test-tools/service-routing-fixture.json').read_text(encoding='utf8'))['response']
    assert fallback.rank(fixture['candidates'],fixture['profile_weights'])['model']['model_version']=='survey_only_v1'
    try:model.rank(fixture['candidates'],[1,1,0,0,0,0])
    except ValueError:pass
    else:raise AssertionError('invalid weights accepted')
report={'passed':12,'training_source':'SYNTHETIC_TEAM_DATA','split_unit':'synthetic_search_not_real_user','logistic_test':metrics,'xgboost_test':xgb_metrics,'max_runtime_probability_error':float(np.max(np.abs(expected-actual)))}
(ROOT/'.test-tools/model-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
