"""실제 검산된 경로 쌍에서 6개 기준별 시간2/거리2 설문을 만든다. 수치를 질문에 맞춰 바꾸지 않는다."""
from pathlib import Path
import sys,json,math,itertools
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
    for f in range(6):
        key=f'{i}:{f}'
        if any(p['key']==key for p in pools):continue
        req={**example,'origin':dict(zip(['lng','lat'],origin)),'destination':dict(zip(['lng','lat'],dest)),'ranks':[1 if n==f else 0 for n in range(6)]}
        try:
            service.search(req)
            pools.append({'key':key,'request':req,'candidates':service.last_pool})
            poolfile.write_text(json.dumps(pools,ensure_ascii=False),encoding='utf8')
            print(key,len(service.last_pool),flush=True)
        except (ValueError,RuntimeError) as error:print(key,str(error),flush=True)
cases={}
for f,factor in enumerate(FACTOR_ORDER):
    pairs=[]
    seen=set()
    for p in pools:
        for a,b in itertools.permutations(p['candidates'],2):
            improvement=a['raw_features'][f]-b['raw_features'][f]
            key=(a['route_key'],b['route_key'])
            if improvement<=.01 or key in seen:continue
            seen.add(key)
            pairs.append({'a':a,'b':b,'improvement':improvement,'origin':p['request']['origin'],'destination':p['request']['destination']})
    questions=[]
    for metric in ['display_duration_s','distance_m']:
        valid=[p for p in pairs if p['b'][metric]-p['a'][metric]>=(60 if metric=='display_duration_s' else 80)]
        for p in valid:
            p['delta']=p['b'][metric]-p['a'][metric]
            p['confounding']=sum(abs(p['a']['raw_features'][j]-p['b']['raw_features'][j])/service.model.spec['scales'][j+2] for j in range(6) if j!=f)
        # 거의 같은 쌍은 대표만 남겨 O(n²) 사례 선정의 실행 시간을 제한한다.
        distinct={}
        for p in valid:
            key=(round(p['improvement'],2),round(p['delta']/10))
            if key not in distinct or p['confounding']<distinct[key]['confounding']:distinct[key]=p
        ordered=sorted(distinct.values(),key=lambda p:p['confounding'])
        valid=ordered[:400]
        best=None
        for small,large in itertools.permutations(valid,2):
            sd=small['b'][metric]-small['a'][metric];ld=large['b'][metric]-large['a'][metric]
            if ld<sd*1.5 or ld-sd<(60 if metric=='display_duration_s' else 100):continue
            similarity=abs(small['improvement']-large['improvement'])/max(small['improvement'],large['improvement'])
            # 개선량 차이 우선 최소화, 나머지 피처 차이는 Train scale로 평가한다.
            confounding=small['confounding']+large['confounding']
            score=(round(similarity,6),confounding,sd+ld)
            if best is None or score<best[0]:best=(score,small,large)
        if best is None:raise RuntimeError('Q4_PAIR_NOT_FOUND: '+factor+' '+metric)
        for level,p in zip(['SMALL','LARGE'],best[1:]):
            questions.append({'question_id':factor+'_'+metric+'_'+level,'dimension':'TIME' if metric=='display_duration_s' else 'DISTANCE','level':level,
                'origin':p['origin'],'destination':p['destination'],'routes':[p['a'],p['b']],'lower_burden_route_key':p['b']['route_key'],
                'improvement':p['improvement'],'single_factor_isolated':False,'notice':'실제 서로 다른 경로이므로 시간·거리와 다른 도로 조건도 함께 달라집니다. 표시된 전체 조건을 비교해주세요.'})
    cases[factor]=questions
out=ROOT/'apps/backend/src/config/q4Cases.json'
out.write_text(json.dumps({'case_set_version':'q4_real_routes_20260916','source':'VERIFIED_INTERNAL_ROUTES','q4_affects_model':False,'cases':cases},ensure_ascii=False,indent=2),encoding='utf8')
print('Saved 24 questions from verified routes',flush=True)
