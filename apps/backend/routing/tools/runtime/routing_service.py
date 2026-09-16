"""Service route candidates using directed snaps, turn histories and hourly FIFO travel time."""
from pathlib import Path
import json,math,sqlite3,heapq,itertools,time,hashlib
from datetime import datetime,timezone
from shapely import from_wkb,STRtree,Point
from shapely.ops import substring
from pyproj import Transformer
import search_engine as graph
from child_feature import TeamCalculator,FEATURE_VERSION
from interface import VERSIONS as STATIC_VERSIONS,FACTOR_ORDER,UNITS,survey_weights
from hourly import HourlySpeed,departure,ETA_VERSION
ROOT=Path(__file__).resolve().parents[2]
VERSIONS={**STATIC_VERSIONS,'contract_version':'anjeon_contract_v6_child100','feature_version':FEATURE_VERSION,'eta_version':ETA_VERSION}
SCALES=[10.,1000.,1000.,10.,10.,1000.]
def gp(b):return from_wkb(b[8+{0:0,1:32,2:48,3:48,4:64}[(b[3]>>1)&7]:])
def number(x):return type(x) in (int,float) and math.isfinite(x)
class RouteService:
 def __init__(self):
  self.clock=HourlySpeed(ROOT);self.calc=TeamCalculator();self.to_xy=Transformer.from_crs(4326,5186,always_xy=True);self.to_ll=Transformer.from_crs(5186,4326,always_xy=True)
  c=sqlite3.connect('file:'+str(ROOT/'data/roads.gpkg')+'?mode=ro',uri=True)
  self.edges={};self.edge_arcs={}
  for aid in graph.arcs:self.edge_arcs.setdefault(aid//2,[]).append(aid)
  for eid,node,b in c.execute('select edge_id,from_node,geom from road_edges'):
   if eid in self.edge_arcs:self.edges[eid]=(node,gp(b))
  c.close();self.edge_ids=sorted(self.edges);self.tree=STRtree([self.edges[e][1] for e in self.edge_ids]);self.spatial=[self.edges[e][1] for e in self.edge_ids]
  self.length_lower=min(v[2]/math.dist(graph.xy[v[0]],graph.xy[v[1]]) for v in graph.arcs.values() if math.dist(graph.xy[v[0]],graph.xy[v[1]])>0)
 def snap(self,location):
  if not isinstance(location,dict) or not all(number(location.get(k)) for k in ['lat','lng']) or not -90<=location['lat']<=90 or not -180<=location['lng']<=180:raise ValueError('valid lat/lng required')
  p=Point(*self.to_xy.transform(location['lng'],location['lat']));ids=self.tree.query(p,predicate='dwithin',distance=40)
  ranked=sorted((p.distance(self.spatial[int(i)]),self.edge_ids[int(i)]) for i in ids)
  if not ranked:raise ValueError('NO_SUPPORTED_ROAD_WITHIN_40M')
  # Use closest physical segment; retain its allowed directions. Never snap to farther roads to shorten a trip.
  distance,eid=ranked[0];node,g=self.edges[eid];f=g.project(p)/g.length;q=g.interpolate(f,normalized=True);ans=[]
  heading=location.get('heading')
  if heading is not None and (not number(heading) or not 0<=heading<360):raise ValueError('heading must be [0,360)')
  for aid in sorted(self.edge_arcs[eid]):
   forward=graph.arcs[aid][0]==node;frac=f if forward else 1-f
   if heading is not None:
    p0=g.interpolate(max(0,f-0.01),normalized=True);p1=g.interpolate(min(1,f+0.01),normalized=True)
    bearing=(math.degrees(math.atan2(p1.x-p0.x,p1.y-p0.y))+(0 if forward else 180))%360
    delta=abs((bearing-heading+180)%360-180)
    if delta>75:continue
   ans.append(dict(arc_id=aid,fraction=frac))
  if not ans:raise ValueError('NO_DIRECTION_MATCH_AT_SNAP')
  lng,lat=self.to_ll.transform(q.x,q.y)
  return ans,dict(edge_id=eid,distance_m=distance,lng=lng,lat=lat,heading_applied=heading is not None,direction_assumption='explicit_heading' if heading is not None else 'all_allowed_directions_on_nearest_edge'),(q.x,q.y)
 def transition(self,previous,aid):
  if previous==-1:return (0.,0.)
  for a,cp,tp in graph.trans.get(previous,[]):
   if a==aid:return cp,tp
  return None
 def route(self,starts,ends,target_xy,departure_ts,mode,weights,use_h=True):
  serial=itertools.count();q=[];best={};parents={};terminal=None;upper=float('inf');states=0
  def cost(aid,lo,hi,ts,cp=0,tp=0):
   dt,_=self.clock.traverse(aid,ts,lo,hi);v=graph.arcs[aid];length=v[2]*(hi-lo)
   if mode=='time':return dt,dt
   if mode=='distance':return length,dt
   return length*(1+5*weights[1]*v[4]+5*weights[2]*v[3]+5*weights[5]*(self.calc.child_length(aid,lo,hi,v[2])/length if length else 0))+50*weights[0]*cp+50*weights[3]*tp,dt
  def heuristic(n):
   if not use_h:return 0.
   h=math.dist(graph.xy[n],target_xy)*min(1.,self.length_lower)
   return h*3.6/130 if mode=='time' else h
  for start in starts:
   aid=start['arc_id'];lo=start['fraction'];v=graph.arcs[aid]
   for end in ends:
    if end['arc_id']==aid and lo<end['fraction']:
     g,dt=cost(aid,lo,end['fraction'],departure_ts)
     if g<upper:upper=g;terminal=(None,[dict(arc_id=aid,start_fraction=lo,end_fraction=end['fraction'])],dt)
   if lo>=1-1e-10:key=(v[1],-1,());g=dt=0.;segment=None
   else:
    hist=graph.rules.advance((),aid)
    if hist is None:continue
    g,dt=cost(aid,lo,1.,departure_ts);key=(v[1],aid,hist);segment=dict(arc_id=aid,start_fraction=lo,end_fraction=1.)
   if g<best.get(key,float('inf')):
    best[key]=g;parents[key]=(None,segment);heapq.heappush(q,(g+heuristic(key[0]),next(serial),g,dt,key))
  began=time.monotonic()
  while q:
   f,_,g,elapsed,key=heapq.heappop(q)
   if g!=best.get(key):continue
   if f>=upper-1e-9:break
   n,prev,hist=key;states+=1
   if states>600000 or time.monotonic()-began>35:raise RuntimeError('ENGINE_SEARCH_LIMIT')
   for end in ends:
    aid=end['arc_id'];hi=end['fraction'];v=graph.arcs[aid]
    if n!=v[0]:continue
    if hi<1e-10:
     if g<upper:upper=g;terminal=(key,[],elapsed)
     continue
    tr=self.transition(prev,aid)
    if tr is None or graph.rules.advance(hist,aid) is None:continue
    extra,dt=cost(aid,0.,hi,departure_ts+elapsed,*tr)
    if g+extra<upper:upper=g+extra;terminal=(key,[dict(arc_id=aid,start_fraction=0.,end_fraction=hi)],elapsed+dt)
   choices=((aid,0.,0.) for aid in graph.outs[n]) if prev==-1 else graph.trans.get(prev,[])
   for aid,cp,tp in choices:
    nh=graph.rules.advance(hist,aid)
    if nh is None:continue
    extra,dt=cost(aid,0.,1.,departure_ts+elapsed,cp,tp);ng=g+extra;nk=(graph.arcs[aid][1],aid,nh)
    if ng<best.get(nk,float('inf')):
     best[nk]=ng;parents[nk]=(key,dict(arc_id=aid,start_fraction=0.,end_fraction=1.));heapq.heappush(q,(ng+heuristic(nk[0]),next(serial),ng,elapsed+dt,nk))
  if terminal is None:raise ValueError('NO_ROUTE_IN_SUPPORTED_GRAPH')
  key,tail,elapsed=terminal;path=[]
  while key is not None:
   key,seg=parents[key]
   if seg:path.append(seg)
  path=path[::-1]+tail
  if not path:raise ValueError('ORIGIN_DESTINATION_TOO_CLOSE')
  return path,dict(objective=mode,objective_cost=upper,expanded_states=states)
 def evaluate(self,segments,departure_at):
  raw=self.calc.evaluate({**STATIC_VERSIONS,'segments':segments});hourly=self.clock.evaluate(segments,departure_at)
  return {**raw,**VERSIONS,**hourly,'static_reference_duration_s':raw['internal_duration_s']}
 def geometry(self,segments):
  coords=[]
  for s in segments:
   aid=s['arc_id'];node,g=self.edges[aid//2]
   if graph.arcs[aid][0]!=node:
    from shapely.geometry import LineString
    g=LineString(list(g.coords)[::-1])
   piece=substring(g,s.get('start_fraction',0),s.get('end_fraction',1),normalized=True)
   for x,y in piece.coords:
    ll=self.to_ll.transform(x,y)
    if not coords or ll!=coords[-1]:coords.append(ll)
  return {'type':'LineString','coordinates':coords}
 def search(self,request):
  dep=request.get('departure_at');ts=departure(dep);ranks=request.get('ranks');weights=survey_weights(ranks)
  q3=request.get('max_detour_minutes')
  if type(q3)!=int or q3 not in [0,5,10,15]:raise ValueError('max_detour_minutes must be 0,5,10,15')
  starts,ss,_=self.snap(request.get('origin'));ends,es,target=self.snap(request.get('destination'))
  proposals=[];failures=[]
  for mode,w in [('time',weights),('distance',weights),('burden',weights),('burden',[0,0,1,0,0,0])]:
   try:segments,diagnostic=self.route(starts,ends,target,ts,mode,w)
   except (ValueError,RuntimeError) as e:
    if mode=='time':raise
    failures.append(dict(objective=mode,reason=str(e)));continue
   key=json.dumps(segments,sort_keys=True)
   if any(p['_key']==key for p in proposals):continue
   result=self.evaluate(segments,dep);geo=self.geometry(segments)
   result.update(segments=segments,geometry=geo,path=[{'lng':p[0],'lat':p[1]} for p in geo['coordinates']],distance=result['distance_m'],duration=result['internal_duration_s'],_key=key,search_diagnostic=diagnostic)
   result['burden_score']=sum(w*x/s for w,x,s in zip(weights,result['raw_features'],SCALES));proposals.append(result)
  minimum=min(p['internal_duration_s'] for p in proposals);limit=minimum+q3*60
  eligible=[p for p in proposals if p['internal_duration_s']<=limit+1e-6]
  for p in proposals:p.pop('_key',None);p.update(q3_eligible=p in eligible,profile_weights=weights,ranking_method='survey_weighted_raw6_v1',ranking_scale=SCALES)
  fastest=min(eligible,key=lambda p:p['internal_duration_s']);shortest=min(eligible,key=lambda p:(p['distance_m'],p['internal_duration_s']));safe=min(eligible,key=lambda p:(p['burden_score'],p['internal_duration_s']))
  return {**VERSIONS,'departure_at':fastest['departure_at'],'minimum_internal_duration_s':minimum,'max_detour_minutes':q3,'internal_time_limit_s':limit,'origin_snap':ss,'destination_snap':es,'profile_weights':weights,'shortestTime':fastest,'shortestDistance':shortest,'safe':safe,'candidate_pool':eligible,'excluded_by_q3_count':len(proposals)-len(eligible),'candidate_generation_failures':failures,'candidate_scope':'minimum-time search is time-dependent; safe/distance are best among generated Q3-feasible candidates','engine':'OSM_ASTAR_HOURLY_V1'}
