from pathlib import Path
import json,sqlite3,hashlib,math
from features import FeatureCalculator
B=Path(__file__).resolve().parent.parent
manifest=B/'manifest.json'
if manifest.exists():
 for r in json.loads(manifest.read_text())['files']:
  p=B/r['path'];assert p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'],r['path']
counts={}
for file in ['features.sqlite','transitions.sqlite','graph.sqlite','routing.sqlite','source_semantics.sqlite','time.sqlite']:
 c=sqlite3.connect('file:'+str(B/'data'/file)+'?mode=ro',uri=True);assert c.execute('pragma integrity_check').fetchone()[0]=='ok'
 counts[file]={t:c.execute('select count(*) from '+t).fetchone()[0] for (t,) in c.execute("select name from sqlite_master where type='table'")}
assert counts['features.sqlite']['edge_feature']==385020 and counts['features.sqlite']['arc_feature']==685205
f=sqlite3.connect('file:'+str(B/'data/features.sqlite')+'?mode=ro',uri=True)
assert f.execute('select count(*) from edge_feature where narrow_score is not null').fetchone()[0]==0
c=FeatureCalculator(B/'data/features.sqlite',B/'data/transitions.sqlite',B/'data/graph.sqlite');rows=[]
for p in json.loads((B/'examples/prior_route_paths.json').read_text()):
 r=c.calculate([{'arc_id':a} for a in p['arc_ids']]);assert len(r['raw_features'])==6 and r['raw_features'][2] is None and not r['eligible_for_model_training'];rows.append(dict(route_index=p['route_index'],**r))
expected=B/'examples/route_metrics.json'
if expected.exists():assert json.loads(expected.read_text())==rows
else:expected.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
a=json.loads((B/'examples/prior_route_paths.json').read_text())[0]['arc_ids'][0]
full=c.calculate([{'arc_id':a}]);half=c.calculate([{'arc_id':a,'start_fraction':.25,'end_fraction':.75}]);assert abs(full['distance_m']-2*half['distance_m'])<1e-8
for i in [1,2,5]:
 x,y=full['raw_features'][i],half['raw_features'][i];assert (x is None and y is None) or (x is not None and y is not None and abs(x-2*y)<1e-8)
try:c.calculate([{'arc_id':-1}]);raise AssertionError('unknown arc silently accepted')
except ValueError:pass
# Check all runtime arc IDs have graph counterparts, and turn endpoints join.
g=sqlite3.connect(':memory:');g.execute('attach database ? as a',(str(B/'data/graph.sqlite'),));g.execute('attach database ? as f',(str(B/'data/features.sqlite'),));g.execute('attach database ? as t',(str(B/'data/transitions.sqlite'),))
assert g.execute('select count(*) from f.arc_feature x left join a.arcs y using(arc_id) where y.arc_id is null').fetchone()[0]==0
assert g.execute('select count(*) from t.transition_proxy x left join a.arcs p on p.arc_id=x.from_arc left join a.arcs q on q.arc_id=x.to_arc where p.arc_id is null or q.arc_id is null or p.to_node!=q.from_node or p.to_node!=x.via_node').fetchone()[0]==0
out={'database_counts':counts,'runtime_cases':len(rows),'partial_fraction_test':'pass','unknown_arc_rejected':True,'arc_and_transition_join_errors':0,'feature_quality':'development_only','physical_intersection_truth_labels':0,'driver_burden_threshold_validation':'not_completed'}
(B/'verification/bundle_checks.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False))
