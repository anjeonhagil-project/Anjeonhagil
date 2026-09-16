# 기능: 방향 arc·회전 제한 이력을 읽고 A* 탐색 기반을 제공한다. 현재 시간대 탐색 진입점은 routing_service.py이다.
from pathlib import Path
import sys,json,sqlite3,collections,heapq,math,time,hashlib
P=Path(__file__).resolve().parent;R=P.parent.parent;B=R
from runtime import Calculator
from interface import REVIEW_TURNS,TeamCalculator
calc=TeamCalculator().engine;conn=sqlite3.connect('file:'+str(R/'data/feature_policy.sqlite')+'?mode=ro',uri=True)
conn.execute('attach database ? as rt',(str(B/'data/routing.sqlite'),))
conn.execute('attach database ? as tr',(str(B/'data/transitions.sqlite'),))
# Common comparison graph: static eligible and all required attributes present.
arcs={};outs=collections.defaultdict(list)
for aid,s,t,L,n,m,ch,eta in conn.execute('select a.arc_id,r.from_node,r.to_node,r.length_m,e.narrow_score,a.merge_score,e.child_nearby,a.eta_dev_seconds from arc_policy a join rt.arcs r using(arc_id) join edge_policy e using(edge_id) where a.eligible=1 and e.eligible=1 and e.narrow_score is not null and a.merge_score is not null and a.eta_dev_seconds>0'):
 arcs[aid]=(s,t,L,n,m,ch,eta);outs[s].append(aid)
for v in outs.values():v.sort()
xy={n:(x,y) for n,x,y in conn.execute('select * from rt.nodes')};trans=collections.defaultdict(list)
for a,b,complexp,turnp in conn.execute('select from_arc,to_arc,complex_proxy,unfamiliar_proxy from tr.transition_proxy'):
 if a in arcs and b in arcs and (a,b) not in REVIEW_TURNS:trans[a].append((b,complexp,turnp))
for v in trans.values():v.sort()
class Rules:
 def __init__(self,rows):
  self.no=set();self.only=collections.defaultdict(lambda:collections.defaultdict(set));self.prefix=set()
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
rules=Rules([(rid,k,tuple(json.loads(v))) for rid,k,v in conn.execute('select * from rt.restriction_sequences')])
profiles={'distance':(0,0,0,0,0),'time':None,'narrow_avoid':(3,0,0,0,0),'balanced_probe':(1,.5,.5,100,50)}
# Euclidean multiplier bounded using actual graph chord lengths; nonnegative turn penalties.
base={}
for name,w in profiles.items():
 base[name]={a:v[6] if w is None else v[2]*(1+w[0]*v[3]+w[1]*v[4]+w[2]*v[5]) for a,v in arcs.items()}
mins={k:min(cost[a]/math.dist(xy[arcs[a][0]],xy[arcs[a][1]]) for a in arcs if math.dist(xy[arcs[a][0]],xy[arcs[a][1]])>0) for k,cost in base.items()}
def search(s,t,name,use_h=True,start_arcs=None,end_arcs=None):
 # Optional explicit approach constraints. These are not a geographic snap algorithm.
 if type(s)!=int or type(t)!=int or s not in xy or t not in xy:raise ValueError('known integer nodes required')
 if name not in profiles:raise ValueError('unsupported objective')
 for allowed,node,side in [(start_arcs,s,0),(end_arcs,t,1)]:
  if allowed is not None and (not isinstance(allowed,(list,tuple,set)) or not allowed or any(type(a)!=int or a not in arcs or arcs[a][side]!=node for a in allowed)):raise ValueError('invalid endpoint arc constraints')
 costs=base[name];w=profiles[name];q=[(0.,0.,s,-1,())];best={(s,-1,()):0.};parent={};states=0
 while q:
  _,g,n,prev,hist=heapq.heappop(q);key=(n,prev,hist)
  if g!=best.get(key):continue
  states+=1
  if states>1000000:raise RuntimeError('search_state_cap')
  if n==t and (end_arcs is None or prev in end_arcs):
   path=[]
   while key in parent:key,a=parent[key];path.append(a)
   return g,path[::-1],states
  choices=((a,0,0) for a in outs[n]) if prev==-1 else trans.get(prev,[])
  for a,cp,tp in choices:
   if prev==-1 and start_arcs is not None and a not in start_arcs:continue
   nh=rules.advance(hist,a)
   if nh is None:continue
   target=arcs[a][1];nk=(target,a,nh);ng=g+costs[a]+(w[3]*cp+w[4]*tp if w else 0)
   if ng<best.get(nk,float('inf')):
    best[nk]=ng;parent[nk]=(key,a);h=math.dist(xy[target],xy[t])*mins[name] if use_h else 0
    heapq.heappush(q,(ng+h,ng,target,a,nh))
 raise RuntimeError('no_route_in_supported_graph')
