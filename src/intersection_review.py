"""Connected compact junction candidates, not ground-truth intersections.
Does not modify routing topology. Argument: original roads GPKG and raw OSM tags JSON.
"""
from pathlib import Path
import sqlite3,json,math,collections,sys
from shapely import from_wkb
B=Path(__file__).resolve().parent.parent
c=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
raw=json.loads(Path(sys.argv[2]).read_text())['ways'];roads=[];adj=collections.defaultdict(set);xy={};layers=collections.defaultdict(set)
car={'motorway','trunk','primary','secondary','tertiary','residential','unclassified','living_street','service'}
for r in c.execute('select edge_id,osm_way_id,from_node,to_node,highway,length_m,geom from road_edges'):
 if r['highway'] not in car and not r['highway'].endswith('_link'):continue
 r=dict(r);t=raw[str(r['osm_way_id'])];b=r.pop('geom');g=from_wkb(b[8+{0:0,1:32,2:48,3:48,4:64}[(b[3]>>1)&7]:]);s=r['from_node'];v=r['to_node'];xy[s]=g.coords[0];xy[v]=g.coords[-1];adj[s].add(v);adj[v].add(s)
 layer=(t.get('layer','0'),t.get('bridge','no'),t.get('tunnel','no'));layers[s].add(layer);layers[v].add(layer);r['roundabout']=t.get('junction') in ['roundabout','circular'];roads.append(r)
jn={n for n in adj if len(adj[n])>=3};results={};members20={}
for threshold in [10,20,30]:
 parent={n:n for n in jn};members={n:{n} for n in jn}
 def root(n):
  while parent[n]!=n:parent[n]=parent[parent[n]];n=parent[n]
  return n
 reject=collections.Counter()
 for e in sorted(roads,key=lambda x:(x['length_m'],x['edge_id'])):
  u,v=e['from_node'],e['to_node']
  if u not in jn or v not in jn or e['length_m']>threshold:continue
  if e['roundabout']:reject['roundabout_needs_separate_grouping']+=1;continue
  if len(layers[u])!=1 or layers[u]!=layers[v]:reject['mixed_or_different_grade']+=1;continue
  a,b=root(u),root(v)
  if a==b:continue
  group=members[a]|members[b]
  if len(group)>8 or any(math.dist(xy[i],xy[j])>2*threshold for i in group for j in group):reject['compactness_or_size']+=1;continue
  a,b=min(a,b),max(a,b);parent[b]=a;members[a]=group;del members[b]
 groups=list(members.values());results[str(threshold)]={'candidate_nodes':len(jn),'groups':len(groups),'multi_node_groups':sum(len(g)>1 for g in groups),'nodes_in_multi_groups':sum(len(g) for g in groups if len(g)>1),'rejected_reasons':dict(reject)}
 if threshold==20:members20=members
examples=[]
for key,group in sorted(members20.items()):
 if len(group)==1:continue
 external=set(n for m in group for n in adj[m] if n not in group)
 examples.append({'candidate_id':key,'node_ids':sorted(group),'coordinates_5186':[xy[n] for n in sorted(group)],'external_node_count_not_physical_arm_count':len(external),'raw_node_degrees':{str(n):len(adj[n]) for n in group},'status':'candidate_not_adopted_as_physical_intersection'})
out={'method':'directly_connected_junction_nodes+equal_single_grade+compactness; no routing topology change','sensitivity':results,'candidate_examples':examples[:20],'all_multi_candidates':examples,'physical_intersections_confirmed':0,'limitations':['Does not follow degree2 connector chains','Roundabouts require separate grouping','Parallel external arms not deduplicated','No independent geographic truth labels'],'references':['https://osmnx.readthedocs.io/en/stable/user-reference.html#osmnx.simplification.consolidate_intersections']}
(B/'verification/intersection_candidates.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(results,flush=True)
