"""최신 계약: Q3 없이 제한시간 내 후보 생성 → 부분 arc 검산 → 세 유형 선정 → 공통 모델 추천."""
import hashlib, json, math, time, sys
from pathlib import Path
from routing_service import RouteService, VERSIONS, graph, survey_weights, departure
from yen import yen_k_shortest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parents[5] / 'ml/src'))
from service_area import ServiceArea
from inference import ChoiceModel

class IntegratedService(RouteService):
    def __init__(self):
        super().__init__()
        self.area = ServiceArea()
        self.model = ChoiceModel()
        self.cache = {}

    def search(self, request):
        if 'max_detour_minutes' in request: raise ValueError('Q3_REMOVED')
        began = time.monotonic(); deadline=began+25
        dep=request.get('departure_at'); ts=departure(dep)
        weights=request['profile_weights'] if 'profile_weights' in request else survey_weights(request.get('ranks',[]))
        if len(weights)!=6 or any(type(x) not in (int,float) or not math.isfinite(x) or x<0 for x in weights) or not (sum(weights)==0 or math.isclose(sum(weights),1,abs_tol=1e-8)): raise ValueError('INVALID_PROFILE_WEIGHTS')
        if not all(self.area.contains(request[k]) for k in ('origin','destination')): raise ValueError('OUTSIDE_SEOUL_SERVICE_AREA')
        starts,ss,_=self.snap(request.get('origin')); ends,es,target=self.snap(request.get('destination'))
        if math.dist(self.to_xy.transform(ss['lng'],ss['lat']),self.to_xy.transform(es['lng'],es['lat']))<5:raise ValueError('ORIGIN_DESTINATION_TOO_CLOSE')
        proposals={}; failures=[]
        def add(segments, method):
            if proposals and time.monotonic()>=deadline:return False
            key=hashlib.sha256(json.dumps(segments,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            if key in proposals: return
            result=self.evaluate(segments,dep)
            result.update(segments=segments,geometry=self.geometry(segments),route_key=key,generation_method=method,
                          display_duration_s=math.floor(result['internal_duration_s']/60+.5)*60,
                          display_duration_source='INTERNAL_HOURLY',profile_weights=weights)
            # LR의 Train scale로 단위 차이를 보정. 학습된 계수는 추천 단계에서 별도로 적용한다.
            result['burden_score']=sum(w*x/s for w,x,s in zip(weights,result['raw_features'],self.model.spec['scales'][2:]))
            proposals[key]=result
            return True
        for mode in ('time','distance','burden'):
            try:
                segments,_=self.route(starts,ends,target,ts,mode,weights,deadline=min(deadline,time.monotonic()+6))
                add(segments, 'ASTAR_'+mode.upper())
            except (ValueError,RuntimeError) as error:
                failures.append({'stage':mode,'reason':str(error)})
        diag={'requested_k':10,'truncated':False}
        # 부분 출발 arc의 진입 이력 및 도착 arc로의 회전 조건을 유지한 Yen 탐색.
        for start in starts:
            if time.monotonic()>=deadline: diag['truncated']=True; break
            aid=start['arc_id']; lo=start['fraction']; source=graph.arcs[aid][1]
            hist=graph.rules.advance((),aid)
            initial=(source,aid,hist) if lo<1-1e-10 else (source,-1,())
            prefix=[dict(arc_id=aid,start_fraction=lo,end_fraction=1.)] if lo<1-1e-10 else []
            for end in ends:
                target_node=graph.arcs[end['arc_id']][0]
                if source==target_node or time.monotonic()>=deadline: continue
                try:
                    attempt_diag={}
                    routes=yen_k_shortest(source,target_node,10,time_limit_seconds=max(.01,min(6,deadline-time.monotonic())),initial_state=initial,
                        end_follow_arc=end['arc_id'] if end['fraction']>1e-10 else None,diagnostics=attempt_diag)
                    diag['truncated']=diag['truncated'] or attempt_diag.get('truncated',False)
                    for route in routes:
                        if time.monotonic()>=deadline:diag['truncated']=True;break
                        middle=[dict(arc_id=a,start_fraction=0.,end_fraction=1.) for a in route['arc_ids']]
                        tail=[dict(arc_id=end['arc_id'],start_fraction=0.,end_fraction=end['fraction'])] if end['fraction']>1e-10 else []
                        add(prefix+middle+tail,'YEN_DISTANCE')
                except (ValueError,RuntimeError) as error: failures.append({'stage':'yen','reason':str(error)})
        if not proposals: raise RuntimeError('NO_VERIFIED_ROUTE_WITHIN_TIME_LIMIT')
        pool=list(proposals.values())
        self.last_pool=pool  # 오프라인 Q4 사례 추출/검증 전용. API 응답에는 표시 후보만 보낸다.
        # 목표 K는 상한이 아닌 탐색 목표다. 기본 목적별 A* 후보도 포함하고 실제 개수를 기록한다.
        selectors=[('SHORTEST_TIME',lambda p:(p['internal_duration_s'],p['distance_m'],p['route_key'])),
                   ('SHORTEST_DISTANCE',lambda p:(p['distance_m'],p['internal_duration_s'],p['route_key'])),
                   ('PERSONALIZED',lambda p:(p['burden_score'],p['internal_duration_s'],p['route_key']))]
        selected={}
        for kind,key in selectors:
            p=min(pool,key=key)
            if p['route_key'] not in selected: selected[p['route_key']]={**p,'route_types':[]}
            selected[p['route_key']]['route_types'].append(kind)
        cards=list(selected.values()); ranking=self.model.rank(cards,weights)
        for i,card in enumerate(cards): card['recommendation_score']=ranking['scores'][i]
        diag['truncated']=diag['truncated'] or time.monotonic()>=deadline
        degraded=diag['truncated'] or bool(failures)
        return {**VERSIONS,'service_contract':'service_20260916','departure_at':cards[0]['departure_at'],
                'profile_weights':weights,'origin_snap':ss,'destination_snap':es,'candidates':cards,
                'recommended_index':ranking['recommended_index'],'recommendation_method':'model_logistic' if self.model.available else 'survey_fallback',
                'model':ranking['model'],'minimum_internal_duration_s':min(p['internal_duration_s'] for p in pool),
                'candidate_scope':'verified_bounded_pool','degraded':degraded,
                'diagnostics':{**diag,'candidate_count':len(pool),'elapsed_seconds':time.monotonic()-began,'failures':failures}}
