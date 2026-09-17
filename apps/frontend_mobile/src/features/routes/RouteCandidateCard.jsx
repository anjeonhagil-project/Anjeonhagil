// 표시 시간·raw6는 서버 snapshot 그대로 사용한다. 내부 지표와 실제 통과 거리를 구분한다.
import { BURDEN_FACTORS } from '../preferences/preferenceFields.js'
import {compareRoute} from './routeComparison.js'
export const ROUTE_LABELS={PERSONALIZED:'내게 편한 길',SHORTEST_TIME:'최단시간',SHORTEST_DISTANCE:'최단거리'}
export const distanceLabel=m=>m>=1000?(m/1000).toFixed(2)+' km':Math.round(m)+' m'
export const durationLabel=s=>s===0?'1분 미만':Math.round(s/60)+'분'
export function FeatureValues({values}) {
    return <dl className="route-features">{BURDEN_FACTORS.map((f,i)=><div key={f.code}><dt>{f.label}</dt><dd>{[1,2].includes(i)?values[i].toFixed(1)+' 점수·m':i===5?Math.round(values[i])+' m':values[i].toFixed(1)+' 지표'}</dd></div>)}</dl>
}
export default function RouteCandidateCard({candidate,selected,recommended,onSelect,candidates=[],weights=[],cardRef,recommendationMethod,q4}) {
    const comparison=compareRoute(candidate,candidates,weights)
    return <article className={'route-card'+(selected?' selected':'')}>
        <button ref={cardRef} data-candidate-id={candidate.candidate_id} type="button" aria-pressed={selected} onClick={onSelect}>
            <span>{candidate.route_types.map(k=>ROUTE_LABELS[k]||k).join(' · ')}</span>
            {recommended&&<strong className="route-badge">{recommendationMethod==='survey_fallback'||candidate.model_version==='survey_only_v1'?'설문 기준 추천':q4?.changed?'모델·설문 참고 추천':'모델 추천'}</strong>}
            <b>{durationLabel(candidate.display_duration_s)} <small>{distanceLabel(candidate.distance_m)}</small></b>
        </button>
        {comparison&&<p className="service-note">최단시간 후보 대비 {comparison.minutes===0?'표시 시간 동일':`${Math.abs(comparison.minutes)}분 ${comparison.minutes>0?'더 소요':'단축'}`} · 거리 {comparison.meters===0?'동일':`${distanceLabel(Math.abs(comparison.meters))} ${comparison.meters>0?'증가':'감소'}`}
            {comparison.reductions.map(r=><span key={r.index}><br/>{BURDEN_FACTORS[r.index].label} 지표 약 {Math.round(r.percent)}% 감소</span>)}
            {comparison.increases.map(r=><span key={r.index}><br/>{BURDEN_FACTORS[r.index].label} 지표 {r.percent===null?'추가 발생':`약 ${Math.round(r.percent)}% 증가`}</span>)}
        </p>}
        <details><summary>도로 부담·교통자료 보기</summary><FeatureValues values={candidate.raw_features}/><p>비교 설명은 저장된 도로 지표 차이이며 모델의 추천 이유나 사고 위험 감소율이 아닙니다.</p><p>어린이 시설 반경 100m 내부 통과거리이며 법정 보호구역 전체와 다를 수 있습니다.</p><p>과거 시간대별 자료와 도로 속도 대체값으로 계산한 예상시간입니다.</p>{candidate.hourly_speed_coverage&&<p>과거 교통자료 적용 {Math.round(100*candidate.hourly_speed_coverage.topis_profile_ratio)}% · 대체 속도 {Math.round(100*candidate.hourly_speed_coverage.fallback_ratio)}% (거리 기준)</p>}</details>
    </article>
}
