// Q4는 초기 설문 보조 정책이다. X8/공통 모델은 고정하고 근소한 후보 간 추천에만 사용한다.
// 아래 0.08/0.04는 검증된 심리계수가 아닌 제한된 파일럿 정책값이며 snapshot에 보존한다.
export const Q4_POLICY='q4_tiebreak_20260917'
export const POLICY=Object.freeze({version:Q4_POLICY,maximumModelGap:.08,maximumAxisBonus:.04,experimental:true})
const fields={TIME:'display_duration_s',DISTANCE:'distance_m'}
export function interpretQ4(session,answers){
    const result={policy:POLICY,sessionId:session.session_id,surveyVersion:session.survey_version,caseSetVersion:session.case_set_version,referenceFactor:session.reference_factor,source:'ONBOARDING_SURVEY',axes:{}}
    for(const dimension of ['TIME','DISTANCE']){
        const rows=session.questions.map((q,i)=>({q,answer:answers.find(a=>a.question_index===i)?.answer})).filter(r=>r.q.dimension===dimension)
        let state='unconfirmed',strength=0,maxRelativeIncrease=0
        const observed=rows.map(({q,answer})=>{
            const chosen=q.routes.find(r=>r.label===answer),low=q.routes.find(r=>r.route_key===q.lower_burden_route_key),high=q.routes.find(r=>r.route_key!==q.lower_burden_route_key)
            const metric=fields[dimension],factor=low?.factor_order?.indexOf(session.reference_factor)
            const valid=low&&high&&factor>=0&&high.raw_features[factor]>low.raw_features[factor]&&low[metric]>high[metric]&&high[metric]>0
            return {questionId:q.question_id,level:q.level,answer:answer??'UNANSWERED',accepted:chosen&&valid?chosen.route_key===low.route_key:null,
                relativeIncrease:valid?(low[metric]-high[metric])/high[metric]:0,
                improvement:valid?high.raw_features[factor]-low.raw_features[factor]:0,
                otherRatio:q.selection_quality?.other_to_target_ratio??null}
        })
        if(session.completed_at&&rows.length===2&&observed.every(o=>o.accepted!==null)){
            const small=observed.find(o=>o.level==='SMALL'),large=observed.find(o=>o.level==='LARGE')
            if(small&&large){
                state=small.accepted?(large.accepted?'accept_both':'accept_small'):(large.accepted?'inconsistent':'prefer_shorter')
                // 다른 조건의 변화와 문항 간 개선량 차이가 클수록 보조 영향력을 줄인다.
                const quality=observed.every(o=>Number.isFinite(o.otherRatio))?1/(1+Math.max(...observed.map(o=>o.otherRatio))):0
                const similarity=Math.min(...observed.map(o=>o.improvement))/Math.max(...observed.map(o=>o.improvement))
                strength=['accept_both','prefer_shorter'].includes(state)?quality*similarity:0
                maxRelativeIncrease=Math.max(...observed.map(o=>o.relativeIncrease))
            }
        }
        if(session.reference_source!=='Q2_TOP'){state='no_reference';strength=0}
        result.axes[dimension]={state,strength,maxRelativeIncrease,observed}
    }
    result.applicable=Object.values(result.axes).some(a=>a.strength>0)
    return result
}

export function applyQ4(result,preference){
    const n=result.candidates.length,base=result.recommended_index
    const audit={...preference,applied:false,changed:false,baselineIndex:base,finalIndex:base,reason:'NO_CONFIRMED_PREFERENCE'}
    result.q4=audit
    if(!preference.enabled){audit.reason='DISABLED';return result}
    if(!preference.applicable)return result
    if(n<2){audit.reason='SINGLE_CANDIDATE';return result}
    if(result.recommendation_method!=='model_logistic'){audit.reason='MODEL_UNAVAILABLE';return result}
    const cards=result.candidates,scores=cards.map(c=>c.recommendation_score/(n-1))
    if(scores.some(s=>!Number.isFinite(s)||s<0||s>1))throw new Error('INVALID_MODEL_SCORES')
    const factor=cards[0].factor_order.indexOf(preference.referenceFactor)
    if(factor<0)throw new Error('INVALID_Q4_FACTOR')
    const burden=cards.map(c=>c.raw_features[factor]),burdenSpan=Math.max(...burden)-Math.min(...burden)
    const bonuses=cards.map((c,i)=>Object.entries(preference.axes).reduce((sum,[dimension,axis])=>{
        const field=fields[dimension],value=c[field],baseline=cards[base][field],span=Math.max(...cards.map(c=>c[field]))-Math.min(...cards.map(c=>c[field]))
        if(!axis.strength||!span)return sum
        if(axis.state==='prefer_shorter')return sum+POLICY.maximumAxisBonus*axis.strength*(baseline-value)/span
        // 수용 응답으로 더 긴 경로 자체를 보상하지 않는다. 해당 부담이 줄어드는 경우에만 반영한다.
        if(axis.state==='accept_both'&&burdenSpan&&value>=baseline&&value-baseline<=baseline*axis.maxRelativeIncrease&&burden[i]<burden[base])return sum+POLICY.maximumAxisBonus*axis.strength*(burden[base]-burden[i])/burdenSpan
        return sum
    },0))
    const dominated=i=>cards.some((other,j)=>j!==i&&other.display_duration_s<=cards[i].display_duration_s&&other.distance_m<=cards[i].distance_m&&other.raw_features.every((v,k)=>v<=cards[i].raw_features[k])&&(other.display_duration_s<cards[i].display_duration_s||other.distance_m<cards[i].distance_m||other.raw_features.some((v,k)=>v<cards[i].raw_features[k])))
    const eligible=cards.map((_,i)=>i).filter(i=>scores[base]-scores[i]<=POLICY.maximumModelGap&&!dominated(i))
    const order=eligible.sort((i,j)=>(scores[j]+bonuses[j])-(scores[i]+bonuses[i])||(i===base?-1:j===base?1:cards[i].internal_duration_s-cards[j].internal_duration_s))
    const chosen=order[0]??base
    Object.assign(audit,{applied:true,changed:chosen!==base,finalIndex:chosen,reason:chosen!==base?'Q4_TIEBREAK':'BASELINE_RETAINED',modelScores:scores,policyBonuses:bonuses,eligibleIndices:eligible})
    result.recommended_index=chosen
    result.recommendation_method='model_logistic_q4'
    return result
}
