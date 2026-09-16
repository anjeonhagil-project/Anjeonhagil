"""Exercise nearby/cross-river/long searches on real supported road points; record bounded failures explicitly."""
from pathlib import Path
import sys,json,time
from shapely import Point
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/backend/routing/tools/runtime'))
from integrated_service import IntegratedService
engine=IntegratedService()
origin={'lng':127.0331208,'lat':37.5110356}
xy=engine.to_xy.transform(origin['lng'],origin['lat'])
results=[]
for label,dx,dy in [('nearby',500,1000),('medium',3000,-1000),('cross_river',-4000,6000),('long',-10000,4000)]:
    idx=int(engine.tree.nearest(Point(xy[0]+dx,xy[1]+dy)))
    point=engine.spatial[idx].interpolate(.5,normalized=True)
    lng,lat=engine.to_ll.transform(point.x,point.y)
    query={'origin':origin,'destination':{'lng':lng,'lat':lat},'departure_at':'2026-09-16T08:00:00+09:00','profile_weights':[2/6,0,3/6,0,0,1/6]}
    start=time.monotonic()
    try:
        result=engine.search(query)
        row={'case':label,'ok':True,'elapsed_s':round(time.monotonic()-start,3),'candidate_count':len(result['candidates']),
            'distance_m':[round(c['distance_m']) for c in result['candidates']],'degraded':result['degraded'],'diagnostics':result['diagnostics'],'query':query}
        for c in result['candidates']:
            again=engine.evaluate(c['segments'],query['departure_at'])
            assert all(abs(a-b)<1e-6 for a,b in zip(again['raw_features'],c['raw_features']))
    except RuntimeError as error:
        row={'case':label,'ok':False,'elapsed_s':round(time.monotonic()-start,3),'error':str(error),'query':query}
    results.append(row);print(json.dumps(row),flush=True)
(ROOT/'.test-tools/routing-benchmark.json').write_text(json.dumps(results,indent=2),encoding='utf8')
