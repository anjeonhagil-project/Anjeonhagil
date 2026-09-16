from pathlib import Path
import sqlite3,json,collections,hashlib,math
P=Path(__file__).resolve().parent.parent;d=json.loads((P/'tools/runtime/fixture_outputs.json').read_text())
c=sqlite3.connect('file:'+str((P/'data/feature_policy.sqlite').resolve())+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
c.execute('attach database ? as rt',(str((P/'data/routing.sqlite').resolve()),))
rows={r['arc_id']:dict(r) for r in c.execute('select a.arc_id,r.from_node,r.to_node,r.length_m,a.merge_score,a.merge_estimated,e.narrow_score,e.is_estimated from arc_policy a join rt.arcs r using(arc_id) join edge_policy e using(edge_id)')}
routes=[]
for x in d['comparisons']:
 seg=x['request']['segments'];raw=x['new']['raw_features']; vals=[]
 for factor in [.8,1.2]:
  v=list(raw)
  for index,key,est in [(1,'merge_score','merge_estimated'),(2,'narrow_score','is_estimated')]:
   v[index]=sum(rows[s['arc_id']]['length_m']*(s.get('end_fraction',1)-s.get('start_fraction',0))*(min(1,max(0,rows[s['arc_id']][key]*factor)) if rows[s['arc_id']][est] else rows[s['arc_id']][key]) for s in seg)
  vals.append(v)
 # Verify baseline aggregation on current DB.
 for index,key in [(1,'merge_score'),(2,'narrow_score')]:
  actual=sum(rows[s['arc_id']]['length_m']*(s.get('end_fraction',1)-s.get('start_fraction',0))*rows[s['arc_id']][key] for s in seg)
  assert math.isclose(actual,raw[index],abs_tol=1e-7)
 path=tuple((s['arc_id'],s.get('start_fraction',0),s.get('end_fraction',1)) for s in seg)
 local_variants={}
 for seed in range(20):
  v=list(raw)
  for index,key,est in [(1,'merge_score','merge_estimated'),(2,'narrow_score','is_estimated')]:
   total=0
   for segitem in seg:
    rr=rows[segitem['arc_id']];score=rr[key]
    if rr[est]:
     u=int.from_bytes(hashlib.sha256(f'{seed}:{segitem["arc_id"]}:{key}'.encode()).digest()[:4],'big')/(2**32-1)
     score=min(1,max(0,score+(.4*u-.2)))
    total+=rr['length_m']*(segitem.get('end_fraction',1)-segitem.get('start_fraction',0))*score
   v[index]=total
  local_variants['local_'+str(seed)]=v
 routes.append(dict(**local_variants,case=x['case'],od=[rows[seg[0]['arc_id']]['from_node'],rows[seg[-1]['arc_id']]['to_node']],path_key=hashlib.sha256(repr(path).encode()).hexdigest(),base=raw,minus20=vals[0],plus20=vals[1],distance_m=x['distance_m']))
groups=collections.defaultdict(list)
for r in routes:groups[tuple(r['od'])].append(r)
scales=[max(1,max(r['base'][i] for r in routes)) for i in range(6)]
weights={'equal':[1/6]*6,**{f'only_{i}':[int(i==j) for j in range(6)] for i in range(6)}}
comparisons=[]
for od,rs in groups.items():
 for name,w in weights.items():
  winners={}
  for variant in ['base','minus20','plus20']+[f'local_{i}' for i in range(20)]:
   scores=[sum(w[i]*r[variant][i]/scales[i] for i in range(6)) for r in rs];m=min(scores)
   winners[variant]=sorted({r['path_key'] for r,s in zip(rs,scores) if math.isclose(s,m,rel_tol=1e-10,abs_tol=1e-10)})
  comparisons.append(dict(local_disjoint=sum(not bool(set(winners['base'])&set(winners[f'local_{i}'])) for i in range(20)),local_set_changed=sum(winners['base']!=winners[f'local_{i}'] for i in range(20)),od=od,weight=name,winners=winners,minus20_disjoint=not bool(set(winners['base'])&set(winners['minus20'])),plus20_disjoint=not bool(set(winners['base'])&set(winners['plus20'])),minus20_winner_set_changed=winners['base']!=winners['minus20'],plus20_winner_set_changed=winners['base']!=winners['plus20']))
summary={'routes':len(routes),'od_groups':len(groups),'candidate_counts':[len(rs) for rs in groups.values()],'weight_scenarios':len(weights),'comparisons':len(comparisons),'scales_diagnostic_not_training':scales,'winner_changes':{k:sum(r[k] for r in comparisons) for k in ['minus20_disjoint','plus20_disjoint','minus20_winner_set_changed','plus20_winner_set_changed']},'local_trials':len(comparisons)*20,'local_disjoint_total':sum(r['local_disjoint'] for r in comparisons),'local_set_changed_total':sum(r['local_set_changed'] for r in comparisons),'local_policy':'20 deterministic per-arc independent additive score perturbations [-0.2,+0.2] applied only to estimated merge/narrow; clipped; diagnostic assumptions not measured uncertainty','scope':'fixed candidate raw6 diagnostic only; estimated merge/narrow scores multiplied together by 0.8 or 1.2 and clipped to [0,1]; no rerouting, ETA or Q3 changes; not final personalized ranking or accuracy proof'}
# Detailed reference results are preserved in tools/runtime/scope_sensitivity.json.
print(json.dumps(summary,ensure_ascii=False,indent=2))
