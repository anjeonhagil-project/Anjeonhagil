// 저장된 후보의 최단시간 경로와 비교한다. 모델의 인과 설명이나 사고 위험 확률이 아니다.
export function compareRoute(candidate,candidates,weights=[]){
    const baseline=candidates.find(c=>c.route_types.includes('SHORTEST_TIME'))
    if(!baseline||baseline.candidate_id===candidate.candidate_id)return null
    const reductions=candidate.raw_features.map((value,index)=>({index,percent:baseline.raw_features[index]>0?100*(baseline.raw_features[index]-value)/baseline.raw_features[index]:0}))
        .filter(r=>weights[r.index]>0&&r.percent>=1).sort((a,b)=>b.percent-a.percent||a.index-b.index).slice(0,2)
    return {minutes:Math.round((candidate.display_duration_s-baseline.display_duration_s)/60),meters:Math.round(candidate.distance_m-baseline.distance_m),reductions}
}
