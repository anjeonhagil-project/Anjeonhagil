"""실제 검산된 경로 쌍에서 6개 기준별 시간2/거리2 설문을 만든다. 수치를 질문에 맞춰 바꾸지 않는다."""
from pathlib import Path
import sys,json,argparse
parser=argparse.ArgumentParser()
parser.add_argument('--select-only',action='store_true')
parser.add_argument('--collect-only',action='store_true')
parser.add_argument('--collect-factor',type=int,choices=range(6))
parser.add_argument('--collect-limit',type=int,default=999)
parser.add_argument('--reverse',action='store_true')
args=parser.parse_args()
attempts=0
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/backend/routing/tools/runtime'))
from integrated_service import IntegratedService
from interface import FACTOR_ORDER
import search_engine as graph
from shapely import Point
service=IntegratedService()
example=json.loads((ROOT/'apps/backend/routing/tools/examples/hourly_search.json').read_text())
example.pop('max_detour_minutes')
poolfile=ROOT/'.test-tools/q4-pools.json'
pools=json.loads(poolfile.read_text(encoding='utf8')) if poolfile.exists() else []
locations=[((127.0331208,37.5110356),(127.0380034,37.5011924)),((127.0380034,37.5011924),(127.0331208,37.5110356)),
 ((127.0276,37.4979),(127.0366,37.5045)),((127.0366,37.5045),(127.0276,37.4979)),
 ((126.9784,37.5665),(126.9870,37.5705)),((126.9870,37.5705),(126.9784,37.5665))]
# 복잡한 교차로를 포함하는 실제 도로 주변에서 추가 OD를 선정한다.
# 이 단계는 오프라인 사례 저작이며 서비스의 40m 최근접 스냅 규칙을 변경하지 않는다.
nodes=sorted({graph.arcs[a][1] for a,choices in graph.trans.items() if any(cp>0 for _,cp,_ in choices)})
for node in nodes[::max(1,len(nodes)//18)][:18]:
    x,y=graph.xy[node]
    points=[]
    for dx,dy in [(-700,-400),(700,400)]:
        edge=service.spatial[int(service.tree.nearest(Point(x+dx,y+dy)))]
        p=edge.interpolate(.5,normalized=True)
        points.append(service.to_ll.transform(p.x,p.y))
    if all(service.area.contains(dict(zip(['lng','lat'],p))) for p in points):locations.append(tuple(points))
for i,(origin,dest) in ([] if '--select-only' in sys.argv else enumerate(locations)):
    if args.reverse:origin,dest=dest,origin
    for f in range(6):
        if args.collect_factor is not None and f!=args.collect_factor:continue
        if attempts>=args.collect_limit:break
        key=f'{i}:{f}'+(':reverse' if args.reverse else '')
        if any(p['key']==key for p in pools):continue
        attempts+=1
        req={**example,'origin':dict(zip(['lng','lat'],origin)),'destination':dict(zip(['lng','lat'],dest)),'ranks':[1 if n==f else 0 for n in range(6)]}
        try:
            service.search(req)
            pools.append({'key':key,'request':req,'candidates':service.last_pool})
            temporary=poolfile.with_suffix('.tmp')
            temporary.write_text(json.dumps(pools,ensure_ascii=False),encoding='utf8')
            temporary.replace(poolfile)
            print(key,len(service.last_pool),flush=True)
        except (ValueError,RuntimeError) as error:print(key,str(error),flush=True)
if args.collect_only:sys.exit(0)
import subprocess
# 선택 규칙은 한 곳에서 관리하여 재생성 시에도 개선된 문항을 유지한다.
subprocess.run(['node',str(ROOT/'scripts/select-q4-cases.mjs'),'--write'],cwd=ROOT,check=True)
