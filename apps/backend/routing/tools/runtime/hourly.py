"""Historical TOPIS speeds and explicit static fallback; piecewise travel times are FIFO."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import sqlite3,json,math,collections
ETA_VERSION='internal_hourly_topis_v1'
KST=timezone(timedelta(hours=9))
def departure(value):
 if not isinstance(value,str):raise ValueError('departure_at with timezone is required')
 try:d=datetime.fromisoformat(value.replace('Z','+00:00'))
 except ValueError:raise ValueError('invalid departure_at')
 if d.tzinfo is None or d.utcoffset() is None:raise ValueError('departure_at timezone required')
 return d.timestamp()
def bucket(ts):
 local_hour=math.floor((ts+32400)/3600);day=local_hour//24
 return int((day+3)%7>=5),local_hour%24,(local_hour+1)*3600-32400
class HourlySpeed:
 def __init__(self,root=None):
  self.root=Path(root) if root else Path(__file__).resolve().parents[2]
  c=sqlite3.connect('file:'+str(self.root/'data/hourly_speed.sqlite')+'?mode=ro',uri=True)
  c.row_factory=sqlite3.Row
  self.mapping={r['arc_id']:dict(r) for r in c.execute('select * from arc_mapping')}
  self.profiles={}
  for r in c.execute('select * from hourly_profile'):
   self.profiles.setdefault(r['topis_link_id'],[None]*48)[r['weekend']*24+r['hour']]=dict(r)
  self.metadata=dict(c.execute('select key,value from metadata'));c.close()
  if self.metadata['eta_version']!=ETA_VERSION:raise ValueError('hourly ETA version mismatch')
 def speed(self,row,ts):
  wd,h,_=bucket(ts);p=self.profiles.get(row['topis_link_id'],[None]*48)[wd*24+h] if row['matched'] else None
  if p and p['n_days']>=3 and p['median_kph'] is not None and math.isfinite(p['median_kph']) and p['median_kph']>0:
   return min(130.,p['median_kph']),'TOPIS_HISTORICAL','PROFILE_AVAILABLE',p['n_days']
  kph=row['fallback_kph']
  if kph is None or not math.isfinite(kph) or kph<=0:raise ValueError('no valid speed for arc')
  reason='PROFILE_MISSING_OR_SPARSE' if row['matched'] else row['reason']
  return kph,'FALLBACK_'+row['fallback_basis'].upper(),reason,0
 def traverse(self,aid,ts,start_fraction=0.,end_fraction=1.,trace=False):
  if type(aid)!=int or aid not in self.mapping:raise ValueError('unknown integer arc_id')
  row=self.mapping[aid]
  if not row['static_eligible']:raise ValueError('arc outside supported graph')
  if not all(type(x) in (int,float) and math.isfinite(x) for x in [ts,start_fraction,end_fraction]) or not 0<=start_fraction<end_fraction<=1:raise ValueError('invalid fraction/time')
  remaining=row['length_m']*(end_fraction-start_fraction);initial=ts;parts=[]
  if not row['matched']:
   kph,source,reason,n=self.speed(row,ts);dt=remaining*3.6/kph
   return dt,([dict(arc_id=aid,distance_m=remaining,duration_s=dt,source=source,reason=reason,topis_link_id=None,n_days=n,weekend=bucket(ts)[0],hour=bucket(ts)[1],speed_kph=kph)] if trace else [])
  for _ in range(240):
   kph,source,reason,n=self.speed(row,ts);wd,h,boundary=bucket(ts);seconds=max(1e-6,boundary-ts)
   travelled=min(remaining,kph/3.6*seconds);dt=travelled*3.6/kph
   if trace:parts.append(dict(arc_id=aid,distance_m=travelled,duration_s=dt,source=source,reason=reason,topis_link_id=row['topis_link_id'],n_days=n,weekend=wd,hour=h,speed_kph=kph))
   ts+=dt;remaining-=travelled
   if remaining<1e-7:return ts-initial,parts
  raise ValueError('travel time exceeds supported 240-hour horizon')
 def evaluate(self,segments,departure_at):
  ts=departure(departure_at);start=ts;parts=[]
  for s in segments:
   dt,p=self.traverse(s['arc_id'],ts,s.get('start_fraction',0.),s.get('end_fraction',1.),True);ts+=dt;parts.extend(p)
  by_source=collections.Counter();fallback=collections.Counter()
  for p in parts:
   by_source[p['source']]+=p['distance_m']
   if p['source']!='TOPIS_HISTORICAL':fallback[p['reason']]+=p['distance_m']
  length=sum(by_source.values());covered=by_source['TOPIS_HISTORICAL']
  return dict(internal_duration_s=ts-start,time_source='INTERNAL_HOURLY',eta_version=ETA_VERSION,departure_at=datetime.fromtimestamp(start,KST).isoformat(),arrival_at=datetime.fromtimestamp(ts,KST).isoformat(),hourly_speed_coverage=dict(total_distance_m=length,topis_profile_distance_m=covered,topis_profile_ratio=covered/length if length else 0.,fallback_distance_m=length-covered,fallback_ratio=(length-covered)/length if length else 0.,source_distance_m=dict(by_source),fallback_reason_distance_m=dict(fallback),historical_estimate=True,live_traffic=False,holiday_separated=False,profile_period='2026-08-01/2026-08-24'),speed_segments=parts)
