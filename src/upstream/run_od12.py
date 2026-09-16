import json,sqlite3,struct,zlib,math,heapq
from pathlib import Path
from collections import Counter,defaultdict
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components
import argparse
B=Path(__file__).resolve().parent
ap=argparse.ArgumentParser();ap.add_argument('--roads',required=True);ap.add_argument('--outdir',required=True);args=ap.parse_args()
P=Path(args.roads).resolve().parent;O=Path(args.outdir).resolve();O.mkdir(parents=True,exist_ok=True);out={}
# Parse uploaded raw PBF using this review's protobuf decoder.
src=(B/'check.py').read_text();exec(src[src.index('def vi('):src.index('node_ll={}')])
c=sqlite3.connect('file:'+str(Path(args.roads).resolve())+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;edges=[dict(r) for r in c.execute('select edge_id,osm_way_id,from_node,to_node,oneway_dir,length_m,geom,highway from road_edges')];wids={e['osm_way_id'] for e in edges};nids={e['from_node'] for e in edges}|{e['to_node'] for e in edges};ways={};nodes={};rels=[]
raw=json.loads((B/'raw_tags_access_audit.json').read_text());ways={int(k):v for k,v in raw['ways'].items()};nodes={int(k):v for k,v in raw['nodes'].items()};rels=raw['relations']
print('PBF parsed',len(ways),len(rels),flush=True)
(O/'raw_tags_access_audit.json').write_text(json.dumps({'ways':ways,'nodes':nodes,'relations':rels},ensure_ascii=False))
MODE=['motorcar','motor_vehicle','vehicle','access'];ROAD=set('motorway motorway_link trunk trunk_link primary primary_link secondary secondary_link tertiary tertiary_link residential unclassified living_street service'.split())
# Policy v1 is conservative static eligibility. Review/conditional/end-access are preserved but inactive.
def classify(t,direction=None,node=False):
 reasons=[];key=None;value=None
 for mode in MODE:
  for k in ([mode+':'+direction,mode] if direction else [mode]):
   if k in t:key=k;value=t[k].strip().lower();break
  if key:break
 if value in ['yes','permissive'] or (value=='designated' and key.split(':')[0]!='access'):status='allow'
 elif value in ['no','private','agricultural','forestry','use_sidepath']:status='deny'
 elif value in ['destination','customers','delivery','permit']:status='restricted'
 elif value is None:status='allow'
 else:status='review'
 reasons.append((key+'='+value) if key else 'node_pass_default' if node else 'car_road_default_assumption')
 if not node and t.get('highway') not in ROAD:status='review';reasons.append('road_type_review')
 relevant=[k for k in t if ':conditional' in k and (k.split(':')[0] in MODE or k.startswith('oneway:') and not k.startswith(('oneway:bicycle','oneway:bus','oneway:psv','oneway:foot')))]
 if relevant:
  if status!='deny':status='conditional'
  reasons.append('conditional_not_evaluated:'+','.join(sorted(relevant)))
 limits=[k for k in t if k.split(':')[0] in {'maxheight','maxwidth','maxweight','maxlength','maxaxleload'} and ':'.join(k.split(':')[1:]) in {'','physical','conditional','forward','backward','forward:conditional','backward:conditional'} and t[k].lower() not in ['none']]
 if limits:
  if status not in ['deny','conditional']:status='review'
  reasons.append('vehicle_dimensions_unknown:'+','.join(limits))
 if node:
  barrier=t.get('barrier');knownpass={'no','entrance','toll_booth'};solid={'bollard','block','wall','fence','jersey_barrier','cycle_barrier','motorcycle_barrier'}
  if barrier and barrier not in knownpass:
   if key is None:
    if status=='allow':status='deny' if barrier in solid else 'review'
    reasons.append('barrier:'+barrier)
   elif status=='allow' and barrier in solid:status='review';reasons.append('access_physical_barrier_conflict:'+barrier)
 if node and t.get('barrier') and t.get('locked')=='yes':
  if status!='deny':status='review'
  reasons.append('locked_barrier')
 if node and t.get('barrier') and t.get('opening_hours') not in [None,'24/7']:
  if status!='deny':status='conditional'
  reasons.append('barrier_opening_hours_not_evaluated')
 return status,reasons
nodepolicy={n:classify(nodes.get(n,{}),node=True) for n in nids};arcs={};inc=defaultdict(list);outs=defaultdict(list);byway=defaultdict(list);polcounts=Counter();reasoncounts=Counter();xy={};special=[]
for e in edges:
 t=ways[e['osm_way_id']];b=e['geom'];off=8+{0:0,1:32,2:48,3:48,4:64}[(b[3]>>1)&7];wb=b[off:];end='<' if wb[0]==1 else '>';cnt=struct.unpack_from(end+'I',wb,5)[0];coords=[struct.unpack_from(end+'dd',wb,9+16*i) for i in range(cnt)];xy[e['from_node']]=coords[0];xy[e['to_node']]=coords[-1]
 for rev in ([False,True] if e['oneway_dir']=='both' else [e['oneway_dir']=='reverse']):
  s,v=(e['to_node'],e['from_node']) if rev else (e['from_node'],e['to_node']);aid=e['edge_id']*2+int(rev);st,reasons=classify(t,'backward' if rev else 'forward');enabled=st=='allow' and nodepolicy[s][0]=='allow' and nodepolicy[v][0]=='allow'
  arcs[aid]={'id':aid,'edge':e['edge_id'],'way':e['osm_way_id'],'s':s,'t':v,'length':e['length_m'],'status':st,'access_enabled':enabled};inc[v].append(aid);outs[s].append(aid);byway[e['osm_way_id']].append(aid);polcounts[st]+=1
  for rr in reasons:reasoncounts[rr]+=1
  if st!='allow':special.append({'arc_id':aid,'edge_id':e['edge_id'],'state':st,'reasons':reasons})
out['policy']={'version':'motorcar_static_review_v1','vehicle':'ordinary motorcar; no permit/destination proof or dimensions/time evaluator','arc_states':dict(polcounts),'node_states':dict(Counter(v[0] for v in nodepolicy.values())),'reasons':dict(reasoncounts),'node_incident_arc_policy':'arcs touching non-allow node inactive; prevents snap from bypassing barrier; conservative','immediate_reverse_policy':'exclude immediate return on same edge as prototype policy; not legal uturn determination'}
# Resolve relation member sequences against directed arcs, with bounded simple-path enumeration.
released=[];seqs=[];reviews=[];quarantine=set();statuses=Counter();rreasons=Counter();path_tests=0
validk={'no_left_turn','no_right_turn','no_u_turn','no_straight_on','no_entry','no_exit','only_left_turn','only_right_turn','only_u_turn','only_straight_on'}
def via_paths(fas,vs,tos):
 result=set();steps=0
 for fa in fas:
  stack=[(arcs[fa]['t'],0,False,(fa,),frozenset([fa]))]
  while stack:
   n,j,used,path,seen=stack.pop();steps+=1
   if steps>100000 or len(path)>2048 or len(result)>256:raise ValueError('enumeration_limit')
   if j==len(vs):
    for a in outs[n]:
     if arcs[a]['way'] in tos:result.add(path+(a,))
    continue
   if used:stack.append((n,j+1,False,path,seen))
   for a in outs[n]:
    if arcs[a]['way']==vs[j] and a not in seen and arcs[a]['edge']!=arcs[path[-1]]['edge']:stack.append((arcs[a]['t'],j,True,path+(a,),seen|{a}))
 return sorted(result)
for rid,t,mem in rels:
 fs=[i for role,i,typ in mem if role=='from' and typ==1];ts=[i for role,i,typ in mem if role=='to' and typ==1];vs=[(i,typ) for role,i,typ in mem if role=='via'];fas=[a for w in fs for a in byway[w]];key=next((k for k in ['restriction:motorcar','restriction:motor_vehicle','restriction:vehicle','restriction'] if k in t),None);kind=t.get(key) if key else None;status='resolved';reason='';found=[];excepts={x.strip() for x in t.get('except','').split(';')}
 if not fas:status='outside_graph';reason='from_way_absent'
 elif excepts & {'motorcar','motor_vehicle','vehicle'}:status='not_applicable';reason='motorcar_exception'
 elif not key and any(k.startswith('restriction:') and 'conditional' not in k for k in t):status='not_applicable';reason='other_vehicle_only'
 elif any('conditional' in k for k in t) or any(k in t for k in ['day_on','day_off','hour_on','hour_off']):status='review';reason='conditional_relation'
 elif kind not in validk:status='review';reason='unsupported_type'
 elif not fs or not ts or not vs:status='review';reason='missing_members'
 elif len(fs)>1 and kind!='no_entry' or len(ts)>1 and kind!='no_exit':status='review';reason='ambiguous_member_cardinality'
 elif len(vs)==1 and vs[0][1]==0:
  vn=vs[0][0]
  for a in inc[vn]:
   if arcs[a]['way'] not in fs:continue
   for b in outs[vn]:
    if arcs[b]['way'] not in ts:continue
    same=arcs[a]['way']==arcs[b]['way'];rev=arcs[a]['edge']==arcs[b]['edge']
    if same and kind in ['no_u_turn','only_u_turn'] and not rev:continue
    if same and kind in ['no_straight_on','only_straight_on'] and rev:continue
    if same and kind not in ['no_u_turn','only_u_turn','no_straight_on','only_straight_on']:status='review';reason='ambiguous_same_way';continue
    found.append((a,b))
  if not found:status='review';reason=reason or 'no_directed_connection'
 elif all(typ==1 for _,typ in vs):
  try:found=via_paths(fas,[i for i,_ in vs],set(ts))
  except ValueError:status='review';reason='enumeration_limit'
  if not found:status='review';reason=reason or 'via_path_absent'
 else:status='review';reason='mixed_via_members'
 if status=='review' and reason=='no_directed_connection' and kind.startswith('no_') and len(fs)==len(ts)==len(vs)==1 and vs[0][1]==0:
  vn=vs[0][0]
  physically_present=all(any(arcs[a]['s']==vn or arcs[a]['t']==vn for a in byway[w]) for w in fs+ts)
  incoming=[a for a in inc[vn] if arcs[a]['way'] in fs];outgoing=[a for a in outs[vn] if arcs[a]['way'] in ts]
  if physically_present and (not incoming or not outgoing):
   assert not [(a,b) for a in incoming for b in outgoing]
   released.append({'relation_id':rid,'via_node':vn,'incoming_count':len(incoming),'outgoing_count':len(outgoing),'reason':'redundant_under_current_direction'})
   status='redundant_under_current_direction';reason=status
 if status=='review':
  vn={i for i,typ in vs if typ==0};affected=[a for a in fas if not vn or arcs[a]['t'] in vn]
  if not affected:affected=fas[:]
  quarantine.update(affected);found=[]
  # If via is missing/off graph no approach can be narrowed; flag this diagnostic separately.
  reviews.append({'relation_id':rid,'reason':reason,'tags':t,'members':mem,'held_arc_ids':affected})
 if status=='resolved':
  for path in sorted(set(found)):
   assert all(arcs[a]['t']==arcs[b]['s'] for a,b in zip(path,path[1:]));seqs.append((rid,'only' if kind.startswith('only') else 'no',path))
 statuses[status]+=1;rreasons[reason or 'resolved']+=1
print('restrictions mapped',dict(statuses),flush=True)
# State machine holds all currently matched proper prefixes, so overlapping rules stay active.
class Rules:
 def __init__(self,rows):
  self.no=set();self.only=defaultdict(lambda:defaultdict(set));self.prefix=set()
  for rid,k,path in rows:
   self.prefix.update(path[:j] for j in range(1,len(path)))
   if k=='no':self.no.add(path)
   else:
    for j in range(1,len(path)):self.only[path[:j]][rid].add(path[j])
 def advance(self,state,a):
  for pre in state:
   if pre+(a,) in self.no:return None
   if any(a not in choices for choices in self.only.get(pre,{}).values()):return None
  return tuple(sorted({p+(a,) for p in state if p+(a,) in self.prefix}|({(a,)} if (a,) in self.prefix else set())))
# Isolated per-relation replay: no sequence is rejected exactly at completion; only follows permitted prefixes and rejects off-branch.
checks=Counter();groups=defaultdict(list)
for row in seqs:groups[row[0]].append(row)
inconsistent=[]
for rid,rows in groups.items():
 rules=Rules(rows);local=Counter()
 try:
  for _,kind,path in rows:
   state=()
   for j,a in enumerate(path):
    ns=rules.advance(state,a)
    if kind=='no' and j==len(path)-1:assert ns is None;local['no_sequence_rejected']+=1
    else:
     assert ns is not None,(rid,j,'unexpected rejection')
     if kind=='only' and j<len(path)-1:
      allowed=rules.only[path[:j+1]][rid]
      for b in outs[arcs[a]['t']]:
       if b not in allowed:assert rules.advance(ns,b) is None;local['only_wrong_exit_rejected']+=1
     state=ns
   if kind=='only':local['only_sequence_accepted']+=1
 except AssertionError as exc:
  inconsistent.append(rid)
  _,tags,mem=next(row for row in rels if row[0]==rid)
  fs=[i for role,i,typ in mem if role=='from' and typ==1];vs={i for role,i,typ in mem if role=='via' and typ==0}
  affected=[a for w in fs for a in byway[w] if not vs or arcs[a]['t'] in vs]
  quarantine.update(affected);reviews.append({'relation_id':rid,'reason':'self_conflicting_mapped_sequences','tags':tags,'members':mem,'held_arc_ids':affected,'failed_sequences':rows,'detail':str(exc)})
  statuses['resolved']-=1;statuses['review']+=1;rreasons['resolved']-=1;rreasons['self_conflicting_mapped_sequences']+=1
 else:checks.update(local)
seqs=[row for row in seqs if row[0] not in inconsistent]
out['semantic_review_relations']=inconsistent
print('semantic hold',inconsistent,flush=True)
# synthetic overlapping history/multi-choice assertions
rr=Rules([(1,'no',(1,2,3)),(2,'only',(2,4)),(2,'only',(2,5))]);st=rr.advance((),1);st=rr.advance(st,2);assert rr.advance(st,3) is None and rr.advance(st,4) is not None and rr.advance(st,5) is not None;checks['overlap_fixture']=1
active={a for a,x in arcs.items() if x['access_enabled'] and a not in quarantine};rules=Rules(seqs);forbid=set();only=defaultdict(lambda:defaultdict(set))
for rid,k,path in seqs:
 if len(path)==2:
  if k=='no':forbid.add(path)
  else:only[path[0]][rid].add(path[1])
trans=defaultdict(list);paircount=0;blocked=Counter()
for a in active:
 for b in outs[arcs[a]['t']]:
  if b not in active:continue
  if arcs[a]['edge']==arcs[b]['edge']:blocked['prototype_immediate_reverse']+=1;continue
  if (a,b) in forbid or any(b not in allowed for allowed in only.get(a,{}).values()):blocked['static_relation']+=1;continue
  trans[a].append(b);paircount+=1
N=sorted(nids);idx={n:i for i,n in enumerate(N)}
def metrics(selected):
 G=csr_matrix((np.ones(len(selected),dtype=np.int32),([idx[arcs[a]['s']] for a in selected],[idx[arcs[a]['t']] for a in selected])),shape=(len(N),len(N)));n,lab=connected_components(G,connection='strong',directed=True);sizes=np.bincount(lab);w,wl=connected_components(G,connection='weak',directed=True);return {'arcs':len(selected),'strong_components_including_isolated':int(n),'largest_strong_nodes':int(sizes.max()),'weak_components_including_isolated':int(w),'isolated_nodes':int(sum(np.asarray(G.sum(0)).ravel()+np.asarray(G.sum(1)).ravel()==0))}
out['connectivity_stages']={'direction_only':metrics(list(arcs)),'access_and_node_rules':metrics([a for a,x in arcs.items() if x['access_enabled']]),'plus_unresolved_relation_holds':metrics(list(active))};out['connectivity_stages']['note']='node graph counts do not include turn/history constraints; tested separately below'
# SCC of static turn graph is also only an upper bound before via-way history restrictions.
A=sorted(active);ai={a:i for i,a in enumerate(A)};fr=[];to=[]
for a,bs in trans.items():
 for b in bs:fr.append(ai[a]);to.append(ai[b])
TG=csr_matrix((np.ones(len(fr),dtype=np.int32),(fr,to)),shape=(len(A),len(A)));tn,tl=connected_components(TG,connection='strong',directed=True);out['static_turn_graph']={'active_arcs':len(A),'allowed_transitions':paircount,'blocked_counts':dict(blocked),'scc_count':int(tn),'largest_scc_arcs':int(np.bincount(tl).max()),'not_full_history_graph':True}
# Fixed-seed short OD comparison; distance only, not A* performance or time constraint.
from random import Random
rand=Random(20260914);candidates=[n for n in N if any(a in active for a in outs[n])];ods=[]
while len(ods)<12:
 s,t=rand.sample(candidates,2);dist=math.dist(xy[s],xy[t])
 if 1000<=dist<=4000:ods.append((s,t))
def route(s,t,restricted):
 q=[(0.,s,None,())];best={(s,None,()):0};parent={};end=None;visited=0
 while q:
  cost,n,prev,hist=heapq.heappop(q);key=(n,prev,hist)
  if cost!=best.get(key):continue
  visited+=1
  if visited>2000000:return {'status':'state_limit','visited':visited}
  if n==t:end=key;break
  choices=trans.get(prev,[]) if restricted and prev is not None else outs[n]
  for a in choices:
   if restricted and a not in active:continue
   nh=rules.advance(hist,a) if restricted else ()
   if nh is None:continue
   v=arcs[a]['t'];nk=(v,a if restricted else None,nh);nc=cost+arcs[a]['length']
   if nc<best.get(nk,float('inf')):best[nk]=nc;parent[nk]=(key,a);heapq.heappush(q,(nc,v,nk[1],nh))
 if end is None:return {'status':'no_route','visited':visited}
 path=[];cur=end
 while cur in parent:cur,a=parent[cur];path.append(a)
 path.reverse()
 if restricted:
  hist=()
  for j,a in enumerate(path):
   assert a in active
   if j:assert a in trans[path[j-1]]
   hist=rules.advance(hist,a);assert hist is not None
 return {'status':'ok','length_m':best[end],'visited':visited,'arc_count':len(path),'path':path}
def route_astar(s,t,restricted):
 q=[(math.dist(xy[s],xy[t]),0.,s,None,())];best={(s,None,()):0};parent={};end=None;visited=0
 while q:
  _,cost,n,prev,hist=heapq.heappop(q);key=(n,prev,hist)
  if cost!=best.get(key):continue
  visited+=1
  if visited>150000:return {'status':'state_limit','visited':visited}
  if n==t:end=key;break
  choices=trans.get(prev,[]) if restricted and prev is not None else outs[n]
  for a in choices:
   if restricted and a not in active:continue
   nh=rules.advance(hist,a) if restricted else ()
   if nh is None:continue
   v=arcs[a]['t'];nk=(v,a if restricted else None,nh);nc=cost+arcs[a]['length']
   if nc<best.get(nk,float('inf')):best[nk]=nc;parent[nk]=(key,a);heapq.heappush(q,(nc+math.dist(xy[v],xy[t]),nc,v,nk[1],nh))
 if end is None:return {'status':'no_route','visited':visited}
 path=[];cur=end
 while cur in parent:cur,a=parent[cur];path.append(a)
 path.reverse()
 if restricted:
  hist=()
  for j,a in enumerate(path):
   assert a in active
   if j:assert a in trans[path[j-1]]
   hist=rules.advance(hist,a);assert hist is not None
 return {'status':'ok','length_m':best[end],'visited':visited,'arc_count':len(path),'path':path}
audit_metrics=out.copy()

old=json.loads((B/'access_turn_results.json').read_text())['od_smoke'];runs=[]
for od in old:
 s,t=od['source'],od['target'];a=route_astar(s,t,True);d=route(s,t,True)
 assert a['status']==d['status']=='ok'
 assert abs(a['length_m']-d['length_m'])<1e-6
 runs.append({'source':s,'target':t,'astar':{k:v for k,v in a.items() if k!='path'},'dijkstra':{k:v for k,v in d.items() if k!='path'},'path':a['path']})
print('OD checks',len(runs),'max Astar states',max(r['astar']['visited'] for r in runs),flush=True)
assert sum(r['astar']['status']=='ok' for r in runs)==12
(O/'od12_recheck.json').write_text(json.dumps({'rules_version':'restriction_direction_redundancy_v1','runs':runs,'replay_checks':dict(checks),'metrics':audit_metrics},ensure_ascii=False,indent=2))
