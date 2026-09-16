"""Counterexamples for the team boundary. All choice fixtures are synthetic TEST_ONLY."""
from pathlib import Path
import sys,json,copy,math,sqlite3,tempfile,os
P=Path(__file__).resolve().parent;R=P.parent.parent;sys.path.insert(0,str(P))
import interface as api
calc=api.TeamCalculator();req=copy.deepcopy(json.loads((R/'tools/examples/route_request.json').read_text()));req.update(api.VERSIONS)
out=calc.evaluate(req)
a=dict(out,display_duration_s=300.,display_duration_source='INTERNAL_STATIC',candidate_id='A',search_id='S1',user_id='U1',exposure_id='E1',profile_version='P1',model_version='M1',scale_version='SC1',displayed=True)
b=dict(a,candidate_id='B',display_duration_s=330.,distance_m=1500.,raw_features=[1.,250.,450.,1.,5.,300.])
c=dict(a,candidate_id='C',display_duration_s=360.)
scaler={'scale_version':'SC1','feature_version':api.FEATURE,'fit_split':'train','fit_manifest_sha256':'0'*64,'values':[60.,100.,1.,100.,100.,1.,1.,100.]};weights=[1/6]*6
for obj in [a,b,c]:obj.update(scaler_sha256=api.scaler_hash(scaler),profile_weights=weights.copy())
choice=dict(event_source='ACTUAL_USER_CHOICE',choice_event_id='TEST_ONLY',selected_candidate_id='B',search_id='S1',user_id='U1',exposure_id='E1',displayed_candidate_ids=['A','B','C'],exposed_at='2026-09-14T10:00:00Z',chosen_at='2026-09-14T10:00:10Z')
rows=[]
def reject(name,fn,contains):
 try:fn()
 except ValueError as e:
  assert contains in str(e),(name,str(e));rows.append({'case':name,'rejected':True,'reason':str(e)});return
 raise AssertionError('ACCEPTED_INVALID: '+name)
pair=lambda aa=a,bb=b,ww=weights,ss=scaler:api.pair_x8(aa,bb,ww,ss)
reject('different_dataset_pair',lambda:pair(bb=dict(b,dataset_version='OTHER_DATASET')),'dataset_version')
reject('different_search_pair',lambda:pair(bb=dict(b,search_id='S2')),'search_id')
reject('reversed_feature_order_pair',lambda:pair(bb=dict(b,factor_order=list(reversed(b['factor_order'])))),'schema')
reject('bool_duration_pair',lambda:pair(aa=dict(a,display_duration_s=True)),'snapshot')
reject('bool_weights',lambda:pair(ww=[True,False,False,False,False,False]),'weights')
reject('undisplayed_pair',lambda:pair(bb=dict(b,displayed=False)),'displayed')
reject('mismatched_eta_version_request',lambda:calc.evaluate(dict(req,eta_version='OTHER_TIME')),'eta_version')
bad=copy.deepcopy(req);bad['segments'][0]['start_fraction']=False
reject('bool_segment_fractions',lambda:calc.evaluate(bad),'fractions')
for field in api.VERSIONS:
 rr=copy.deepcopy(req);rr.pop(field)
 reject('missing_'+field,lambda rr=rr:calc.evaluate(rr),field)
for field in ['units','user_id','exposure_id','profile_version','model_version','scale_version']:
 changed=dict(b);changed[field]=['m']*6 if field=='units' else 'OTHER'
 reject('changed_'+field,lambda changed=changed:pair(bb=changed),'schema' if field=='units' else field)
reject('test_split_scaler',lambda:pair(ss=dict(scaler,fit_split='test')),'provenance')
reject('zero_scale',lambda:pair(ss=dict(scaler,values=[0.]*8)),'scales')
reject('bool_scale',lambda:pair(ss=dict(scaler,values=[True]*8)),'scales')
reject('scale_identity_mismatch',lambda:pair(ss=dict(scaler,scale_version='OTHER')),'scale_version')
reject('changed_scale_same_version',lambda:pair(ss=dict(scaler,values=[2.]*8)),'content')
reject('changed_weights_same_profile',lambda:pair(bb=dict(b,profile_weights=[1.,0.,0.,0.,0.,0.])),'profile weights')
reject('boolean_profile_weights',lambda:pair(bb=dict(b,profile_weights=[True,False,False,False,False,False])),'profile weights')
reject('duplicate_candidate_pair',lambda:pair(bb=a),'distinct')
reject('NaN_feature',lambda:pair(bb=dict(b,raw_features=[float('nan')]*6)),'snapshot')
reject('unexposed_choice',lambda:api.make_training_pairs([a,b,c],dict(choice,selected_candidate_id='D'),weights,scaler),'exposure')
reject('abandonment',lambda:api.make_training_pairs([a,b,c],dict(choice,selected_candidate_id=None),weights,scaler),'exposure')
reject('out_of_order_exposure',lambda:api.make_training_pairs([a,b,c],dict(choice,displayed_candidate_ids=['C','B','A']),weights,scaler),'order')
reject('choice_before_exposure',lambda:api.make_training_pairs([a,b,c],dict(choice,chosen_at='2026-09-14T09:59:00Z'),weights,scaler),'predates')
reject('naive_timestamp',lambda:api.make_training_pairs([a,b,c],dict(choice,chosen_at='2026-09-14T10:00:10'),weights,scaler),'timezone')
reject('mock_label',lambda:api.make_training_pairs([a,b,c],dict(choice,event_source='SIMULATED'),weights,scaler),'actual')
# Startup rejects mismatched actual DB metadata, even with intact rules files.
original_factory=api.Calculator
for field in api.VERSIONS:
 fake=copy.copy(calc.engine);fake.db=sqlite3.connect(':memory:');fake.db.deserialize(calc.engine.db.serialize());fake.db.execute('update metadata set value=? where key=?',('OTHER',field))
 api.Calculator=lambda fake=fake:fake
 reject('startup_'+field,lambda:api.TeamCalculator(),field)
 fake.db.close()
api.Calculator=original_factory
xx=pair();rev=pair(aa=b,bb=a)
assert all(math.isclose(x,-y,abs_tol=1e-12) for x,y in zip(xx,rev))
expected=[(x-y)*w/s for x,y,w,s in zip([300.,a['distance_m']]+a['raw_features'],[330.,1500.]+b['raw_features'],[1.,1.]+weights,scaler['values'])]
assert xx==expected
pairs=api.make_training_pairs([a,b,c],choice,weights,scaler)
assert [(p['candidate_a'],p['candidate_b'],p['Y']) for p in pairs]==[('A','B',0),('B','C',1)]
assert sum(p['sample_weight'] for p in pairs)==1.
# A partial physical passage must be invariant to reversal of its directed arc coordinates.
partial=None
for eid,inside,length in calc.circles.execute('select edge_id,inside_circle_length_m,intervals_json from edge_child_circle where inside_circle_length_m>0 limit 3000'):
 if len(json.loads(length))==1 and json.loads(length)[0]==[0,1]:continue
 try:
  f=calc.evaluate({**api.VERSIONS,'segments':[{'arc_id':eid*2,'start_fraction':.1,'end_fraction':.6}]})
  revp=calc.evaluate({**api.VERSIONS,'segments':[{'arc_id':eid*2+1,'start_fraction':.4,'end_fraction':.9}]})
 except ValueError:continue
 if not 1e-6<f['quality']['child_circle_inside_m']<f['distance_m']-1e-6:continue
 assert math.isclose(f['quality']['child_circle_inside_m'],revp['quality']['child_circle_inside_m'],abs_tol=1e-7)
 assert math.isclose(f['distance_m'],revp['distance_m'],abs_tol=1e-7)
 partial={'edge_id':eid,'forward_inside_m':f['quality']['child_circle_inside_m'],'reverse_inside_m':revp['quality']['child_circle_inside_m']};break
assert partial is not None
# Hard links are read-only test inputs; unlink the test path before writing replacement bytes.
with tempfile.TemporaryDirectory() as tmp:
 testroot=Path(tmp);names=json.loads((P/'data_manifest.json').read_text())
 for name in list(names)+['tools/runtime/data_manifest.json']:
  dest=testroot/name;dest.parent.mkdir(parents=True,exist_ok=True);os.link(R/name,dest)
 assert api.verify_runtime_data(testroot)
 victim=testroot/next(iter(names));victim.unlink();victim.write_bytes(b'TEST_ONLY_WRONG_DATABASE')
 reject('mixed_database_bytes',lambda:api.verify_runtime_data(testroot),'data hash')
 victim.unlink();reject('missing_database',lambda:api.verify_runtime_data(testroot),'data hash')
 mf=testroot/'tools/runtime/data_manifest.json';mf.unlink();mf.write_text('{}')
 reject('changed_runtime_manifest',lambda:api.verify_runtime_data(testroot),'manifest')
old=json.loads((P/'fixture_outputs.json').read_text())
unchanged=0
for r in old['comparisons']:
 rr=dict(r['request']);rr.update(api.VERSIONS);v=calc.evaluate(rr)
 for key in ['raw_features','distance_m','internal_duration_s']:assert v[key]==r['new'][key],(r['case'],key)
 unchanged+=1
summary={'test_data':'SYNTHETIC_TEST_ONLY_NOT_TRAINING_DATA','invalid_cases_rejected':len(rows),'original_eight_holes_rejected':all(r['rejected'] for r in rows[:8]),'valid_X_unchanged':True,'A_B_antisymmetry':True,'canonical_labels_and_search_weight':True,'partial_circle_direction_invariance':partial,'prior_release_fixed_paths_numerically_unchanged':unchanged,'cases':rows}
print(json.dumps(summary,ensure_ascii=False))
