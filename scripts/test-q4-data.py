"""Recalculate every distinct Q4 route against the frozen road and hourly datasets."""
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/backend/routing/tools/runtime'))
from routing_service import RouteService
engine=RouteService()
bank=json.loads((ROOT/'apps/backend/src/config/q4Cases.json').read_text(encoding='utf8'))
seen=set()
for questions in bank['cases'].values():
    for question in questions:
        for route in question['routes']:
            key=(route['route_key'],route['departure_at'])
            if key in seen:continue
            seen.add(key)
            actual=engine.evaluate(route['segments'],route['departure_at'])
            for key in ['distance_m','internal_duration_s']:assert abs(actual[key]-route[key])<.001
            assert all(abs(a-b)<.001 for a,b in zip(actual['raw_features'],route['raw_features']))
            assert abs(route['raw_features'][5]-actual['quality']['child_circle_inside_m'])<.001
            coords=engine.geometry(route['segments'])['coordinates']
            assert len(coords)==len(route['geometry']['coordinates'])
            assert all(abs(x-u)<1e-9 and abs(y-v)<1e-9 for (x,y),(u,v) in zip(coords,route['geometry']['coordinates']))
report={'questions':sum(map(len,bank['cases'].values())),'distinct_routes_verified':len(seen),'geometry_raw6_hourly_and_child_inside':'PASS'}
(ROOT/'.test-tools/q4-verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
