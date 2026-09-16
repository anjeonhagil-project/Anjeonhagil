"""Current release gate: five preserved features, exact child exposure, hourly FIFO and search."""
from pathlib import Path
import sys,json,math,sqlite3,copy,hashlib,collections,argparse
sys.path.insert(0,str(Path(__file__).resolve().parent/'runtime'))
from routing_service import RouteService,VERSIONS
from hourly import departure,bucket
from interface import VERSIONS as OLD
from learning import pair_x8,scaler_hash,FACTOR_ORDER,UNITS
ROOT=Path(__file__).resolve().parent.parent
engine=RouteService();fixtures=json.loads((ROOT/'tools/runtime/fixture_outputs.json').read_text())['comparisons']
ap=argparse.ArgumentParser();ap.add_argument('--report',default='hourly_validation.local.json');args=ap.parse_args()
reference={r['case']:r for r in json.loads((ROOT/'evidence/final_before_child100_reference.json').read_text())['fixed_paths']}
report={'fixed_paths':[],'astar_dijkstra':[],'hour_boundary_fifo_checks':0,'rejected':[]}
for f in fixtures:
 seg=f['request']['segments'];old=engine.calc.legacy.evaluate({**OLD,'segments':seg});new=engine.evaluate(seg,'2026-09-15T08:00:00+09:00');sun=engine.evaluate(seg,'2026-09-20T22:00:00+09:00')
 assert old['distance_m']==new['distance_m'] and old['raw_features'][:5]==new['raw_features'][:5]
 assert abs(new['raw_features'][5]-new['quality']['child_circle_inside_m'])<1e-7 and new['raw_features'][5]<=old['raw_features'][5]+1e-7
 baseline=reference[f['case']]
 assert abs(new['internal_duration_s']-baseline['weekday_s'])<1e-6 and abs(sun['internal_duration_s']-baseline['weekend_s'])<1e-6
 assert abs(old['raw_features'][5]-f['child_whole_nearby_m'])<1e-7
 cv=new['hourly_speed_coverage'];assert abs(cv['total_distance_m']-old['distance_m'])<1e-5
 assert abs(cv['topis_profile_distance_m']+cv['fallback_distance_m']-cv['total_distance_m'])<1e-5
 assert abs(sum(p['duration_s'] for p in new['speed_segments'])-new['internal_duration_s'])<0.0001
 report['fixed_paths'].append(dict(case=f['case'],distance_m=new['distance_m'],first_five_preserved=True,old_child_nearby_edge_m=old['raw_features'][5],new_child_circle_inside_m=new['raw_features'][5],static_s=old['internal_duration_s'],weekday_s=new['internal_duration_s'],weekend_s=sun['internal_duration_s'],covered_ratio=cv['topis_profile_ratio']))
# Strong clock test: a deliberately long segment crosses the time boundary, with very different adjacent speeds.
clock=copy.copy(engine.clock);aid=next(k for k,r in clock.mapping.items() if r['matched']);r={**clock.mapping[aid],'length_m':1000};clock.mapping={aid:r};clock.profiles={r['topis_link_id']:[dict(n_days=3,median_kph=36 if h%24==8 else 72) for h in range(48)]}
a=departure('2026-09-15T08:59:30+09:00');dt,parts=clock.traverse(aid,a,trace=True);assert abs(dt-65)<1e-5 and len(parts)==2
report['synthetic_hour_boundary']={'distance_m':1000,'first_300m_kph':36,'remaining_700m_kph':72,'duration_s':dt,'expected_s':65}
matched=[k for k,r in engine.clock.mapping.items() if r['matched']]
for aid in matched[::max(1,len(matched)//100)]:
 for moment in ['2026-09-15T08:59:59+09:00','2026-09-18T23:59:59+09:00','2026-09-20T23:59:59+09:00']:
  ts=departure(moment);arr=[]
  for offset in [-1,0,1,2]:arr.append(ts+offset+engine.clock.traverse(aid,ts+offset)[0])
  assert arr==sorted(arr);report['hour_boundary_fifo_checks']+=1
assert bucket(departure('2026-09-18T23:59:59+09:00'))[:2]==(0,23)
assert bucket(departure('2026-09-19T00:00:00+09:00'))[:2]==(1,0)
c=sqlite3.connect(ROOT/'data/hourly_speed.sqlite')
assert c.execute('select count(*) from arc_mapping where matched=1 and (topis_link_id is null or max_distance_m>12 or mean_distance_m>8 or max_angle_deg>25 or source_fraction_end<=source_fraction_start or static_eligible<>1)').fetchone()[0]==0
report['child_feature_contract']='raw6[5] equals exact path intersection length inside union of facility-centred 100 m circles'
report['matched_arcs_rules_checked']=len(matched)
# New time contract uses same admissible heuristic for both full and partial snaps.
case=json.loads((ROOT/'evidence/od10_hourly_service.json').read_text())['request']
for dep in ['2026-09-15T08:00:00+09:00','2026-09-20T22:00:00+09:00']:
 starts,_,_=engine.snap(case['origin']);ends,_,xy=engine.snap(case['destination'])
 for mode in ['time','distance','burden']:
  weights=[0,0,0,0,0,1] if mode=='burden' else [1/6]*6
  a,ad=engine.route(starts,ends,xy,departure(dep),mode,weights,True);b,bd=engine.route(starts,ends,xy,departure(dep),mode,weights,False)
  assert abs(ad['objective_cost']-bd['objective_cost'])<1e-5
  if mode=='burden':
   value=engine.evaluate(a,dep)
   assert abs(ad['objective_cost']-(value['distance_m']+5*value['raw_features'][5]))<1e-5
  report['astar_dijkstra'].append(dict(departure_at=dep,mode=mode,cost=ad['objective_cost'],astar_states=ad['expanded_states'],dijkstra_states=bd['expanded_states']))
q=engine.search({**case,'max_detour_minutes':0});assert all(x['internal_duration_s']<=q['minimum_internal_duration_s']+1e-5 for x in q['candidate_pool']);report['q3_zero_feasible']=True
scaler={'scale_version':'validation_only_not_fitted_model','feature_version':VERSIONS['feature_version'],'fit_split':'train','fit_manifest_sha256':'0'*64,'values':[60,1000,10,1000,1000,10,10,1000]}
snap={**VERSIONS,'candidate_id':'a','search_id':'s','user_id':'u','exposure_id':'e','profile_version':'p','model_version':'test_only','scale_version':scaler['scale_version'],'scaler_sha256':scaler_hash(scaler),'displayed':True,'factor_order':FACTOR_ORDER,'units':UNITS,'raw_features':[1,2,3,4,5,6],'profile_weights':[1/6]*6,'display_duration_s':120,'distance_m':1000,'display_duration_source':'INTERNAL_HOURLY','departure_at':'2026-09-15T08:00:00+09:00'}
b={**snap,'candidate_id':'b','distance_m':1200};x=pair_x8(snap,b,[1/6]*6,scaler);y=pair_x8(b,snap,[1/6]*6,scaler);assert all(i==-j for i,j in zip(x,y));report['x8_hourly_antisymmetric']=True
for name,fn in [('mixed departure',lambda:pair_x8(snap,{**b,'departure_at':'2026-09-15T09:00:00+09:00'},[1/6]*6,scaler)),('old child feature',lambda:pair_x8(snap,{**b,'feature_version':'static_burden_v4'},[1/6]*6,scaler)),('old feature scaler',lambda:pair_x8(snap,b,[1/6]*6,{**scaler,'feature_version':'static_burden_v4'})),('static ETA',lambda:pair_x8(snap,{**b,'eta_version':OLD['eta_version']},[1/6]*6,scaler)),('timezone missing',lambda:departure('2026-09-15T08:00:00')),('unsupported q3',lambda:engine.search({**case,'max_detour_minutes':20})),('reversed fraction',lambda:engine.evaluate([{'arc_id':aid,'start_fraction':.9,'end_fraction':.1}],case['departure_at']))]:
 try:fn()
 except (ValueError,TypeError):report['rejected'].append(name)
 else:raise AssertionError('accepted '+name)
report['final_hourly_reference_matches']=len(reference)
report['child_feature_changed_cases']=sum(r['old_child_nearby_edge_m']-r['new_child_circle_inside_m']>1e-7 for r in report['fixed_paths'])
assert report['child_feature_changed_cases']==40
report['all_passed']=True
Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='fixed_paths'},ensure_ascii=False,indent=2),flush=True)
