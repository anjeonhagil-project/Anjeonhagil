"""Regression for real-choice export conversion, user isolation, random A/B, and per-search weights (test fixtures only)."""
from pathlib import Path
import sys,json,copy,uuid,tempfile
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'ml/src'))
from choice_data import load_choices
from split import user_split,validate_splits
from inference import ChoiceModel
base=json.loads((ROOT/'.test-tools/service-routing-fixture.json').read_text(encoding='utf8'))['response']
records=[]
for n in range(60):
    user=str(uuid.uuid5(uuid.NAMESPACE_URL,'ag-test-user-'+str(n)));search=str(uuid.uuid5(uuid.NAMESPACE_URL,'ag-test-search-'+str(n)))
    exposure=str(uuid.uuid5(uuid.NAMESPACE_URL,'ag-test-exposure-'+str(n)))
    candidates=copy.deepcopy(base['candidates'][:2 if n%2 else 3])
    for i,c in enumerate(candidates):
        c.update(candidate_id=str(uuid.uuid5(uuid.NAMESPACE_URL,search+str(i))),search_id=search,user_id=user,exposure_id=exposure,displayed=True)
    records.append({'split':user_split(user),'profile_weights':base['profile_weights'],'snapshots':candidates,
        'choice':{'user_id':user,'search_id':search,'exposure_id':exposure,'choice_event_id':str(uuid.uuid5(uuid.NAMESPACE_URL,'ag-test-choice-'+str(n))),
            'sample_origin':'service','event_source':'ACTUAL_USER_CHOICE','displayed_candidate_ids':[c['candidate_id'] for c in candidates],'selected_candidate_id':candidates[n%len(candidates)]['candidate_id']}})
with tempfile.TemporaryDirectory(dir=ROOT/'.test-tools') as tmp:
    path=Path(tmp)/'test-only.jsonl'
    def save(values):path.write_text('\n'.join(json.dumps(v) for v in values),encoding='utf8')
    save(records);frame,meta=load_choices(path);again,_=load_choices(path)
    assert frame.equals(again)
    assert set(frame.y)=={0,1}
    assert (frame.groupby('search_id').sample_weight.sum()==1).all()
    validate_splits(frame)
    assert sum(len(set(frame[frame.split==s].user_id)&set(frame[frame.split==t].user_id)) for s,t in [('train','validation'),('train','test'),('validation','test')])==0
    excluded=copy.deepcopy(records);excluded[0]['choice']['sample_origin']='onboarding'
    save(excluded);_,meta=load_choices(path);assert meta['excluded_events']==1
    bad=copy.deepcopy(records);bad[0]['choice']['selected_candidate_id']=str(uuid.uuid4());save(bad)
    try:load_choices(path)
    except ValueError:pass
    else:raise AssertionError('unexposed choice accepted')
    bad=copy.deepcopy(records);bad[0]['snapshots'][0]['profile_weights']=[1,0,0,0,0,0];save(bad)
    try:load_choices(path)
    except ValueError:pass
    else:raise AssertionError('snapshot weight mismatch accepted')
    bad=copy.deepcopy(base['candidates'][0]);bad['raw_features'][0]=float('nan')
    try:ChoiceModel().rank([bad],base['profile_weights'])
    except ValueError:pass
    else:raise AssertionError('single invalid candidate accepted')
report={'passed':9,'source':'test-only fabricated labels on real road snapshots','real_user_metrics':False}
(ROOT/'.test-tools/learning-data-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
