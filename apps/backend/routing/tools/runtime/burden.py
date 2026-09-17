"""Localize frozen raw6 contributions; fail closed if explanatory totals disagree."""
import math

def explain(service, segments, expected):
    if len(expected)!=6 or any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in expected):raise ValueError('INVALID_RAW6')
    calc=service.calc.legacy.engine; base=calc.base; events=[]; totals=[0.]*6;geometries={}
    offset=0.;previous=None;last_action=None
    def event(index,value,start,end,segment,basis,estimated=False,previous_offset=None):
        if value<=0:return
        totals[index]+=value
        key=(segment['arc_id'],segment['start_fraction'],segment['end_fraction'])
        if key not in geometries:geometries[key]=service.geometry([segment])
        events.append(dict(factor_index=index,value=value,start_m=start,end_m=end,
            geometry=geometries[key],basis=basis,estimated=bool(estimated),previous_action_m=previous_offset))
    for s in segments:
        aid=s['arc_id'];lo=s.get('start_fraction',0.);hi=s.get('end_fraction',1.)
        arc=base.g.execute('select * from arcs where arc_id=?',(aid,)).fetchone()
        edge=calc.db.execute('select * from edge_policy where edge_id=?',(aid//2,)).fetchone()
        policy=calc.db.execute('select * from arc_policy where arc_id=?',(aid,)).fetchone()
        length=arc['length_m'];used=length*(hi-lo)
        event(1,used*policy['merge_score'],offset,offset+used,s,policy['merge_basis'],policy['merge_estimated'])
        event(2,used*edge['narrow_score'],offset,offset+used,s,edge['basis'],edge['is_estimated'])
        for a,b in service.calc.intervals.get(aid//2,()):
            if aid%2:a,b=1-b,1-a
            a,b=max(lo,a),min(hi,b)
            if b>a:event(5,length*(b-a),offset+length*(a-lo),offset+length*(b-lo),dict(arc_id=aid,start_fraction=a,end_fraction=b),'facility_100m_circle_union')
        if previous is not None:
            tr=base.t.execute('select * from transition_proxy where from_arc=? and to_arc=?',(previous['arc_id'],aid)).fetchone()
            eligible=tr['node_degree']>=3 or previous['osm_way_id']!=arc['osm_way_id']
            point=dict(arc_id=aid,start_fraction=lo,end_fraction=min(hi,lo+max(1e-8,min(1.,length and 1/length))))
            event(0,int(tr['node_degree']>=base.params['complex_node_degree_min']),offset,offset,point,'connected_road_degree_proxy',True)
            event(3,int(eligible and tr['abs_turn_angle_deg']>=base.params['turn_angle_min_deg']),offset,offset,point,'turn_angle_proxy',True)
            action=eligible and (tr['abs_turn_angle_deg']>=base.params['action_angle_min_deg'] or arc['highway'].endswith('_link') or previous['highway'].endswith('_link'))
            if action:
                if last_action is not None and 0<offset-last_action<=base.params['consecutive_max_distance_m']:
                    event(4,1,offset,offset,point,'consecutive_action_distance_proxy',True,last_action)
                last_action=offset
        offset+=used;previous=arc
    if any(not math.isclose(a,b,rel_tol=1e-8,abs_tol=1e-6) for a,b in zip(totals,expected)):
        raise RuntimeError('BURDEN_EXPLANATION_MISMATCH')
    events.sort(key=lambda e:(e['start_m'],e['factor_index']))
    return dict(version='raw6_localization_v1',totals=totals,events=events,
        notice='정적 도로 자료에 따른 부담 지표입니다. 실제 차로 변경 지시나 사고 위험 예측이 아닙니다.')
