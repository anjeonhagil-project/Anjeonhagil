// 실제 문항의 A/B 반전·보류·프로필 분리와 제한된 추천 변경을 확인한다. 효과 검증용 사용자 실험은 아니다.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {interpretQ4,applyQ4,POLICY} from '../apps/backend/src/modules/preferences/q4Policy.js'
const bank=JSON.parse(readFileSync('apps/backend/src/config/q4Cases.json','utf8'))
let passed=0
for(const [factor,questions] of Object.entries(bank.cases)){
    const session={session_id:'session',survey_version:'survey',case_set_version:bank.case_set_version,reference_factor:factor,reference_source:'Q2_TOP',completed_at:'2026-09-17',questions:questions.map(q=>({...q,routes:q.routes.map((r,i)=>({...r,label:i?'B':'A'}))}))}
    const answers=accept=>session.questions.map((q,i)=>({question_index:i,answer:q.routes.find(r=>(r.route_key===q.lower_burden_route_key)===accept).label}))
    const accepted=interpretQ4(session,answers(true)),declined=interpretQ4(session,answers(false))
    assert.equal(accepted.axes.TIME.state,'accept_both');assert.equal(declined.axes.DISTANCE.state,'prefer_shorter');assert.ok(accepted.applicable);passed++
    const reversed=structuredClone(session);reversed.questions.forEach(q=>{q.routes.reverse();q.routes.forEach((r,i)=>{r.label=i?'B':'A'})})
    const flipped=interpretQ4(reversed,answers(true).map(a=>({...a,answer:a.answer==='A'?'B':'A'})))
    for(const dimension of ['TIME','DISTANCE'])assert.equal(flipped.axes[dimension].strength,accepted.axes[dimension].strength);passed++
    const unsure=interpretQ4(session,answers(true).map(a=>({...a,answer:'UNSURE'})))
    assert.equal(unsure.applicable,false);assert.equal(interpretQ4({...session,completed_at:null},answers(true)).applicable,false);passed++
    const mixed=answers(true);mixed[0]=answers(false)[0]
    assert.equal(interpretQ4(session,mixed).axes.TIME.state,'inconsistent')
    mixed[0]=answers(true)[0];mixed[1]=answers(false)[1]
    assert.equal(interpretQ4(session,mixed).axes.TIME.strength,0)
    assert.equal(interpretQ4({...session,reference_source:'DEFAULT_REFERENCE'},answers(true)).applicable,false);passed++
}
const card=(time,burden,score)=>({display_duration_s:time,internal_duration_s:time,distance_m:1000,raw_features:[burden,0,0,0,0,0],factor_order:Object.keys(bank.cases),recommendation_score:score})
const fixture=()=>({recommended_index:0,recommendation_method:'model_logistic',candidates:[card(600,4,.51),card(660,1,.49)]})
const preference={enabled:true,applicable:true,referenceFactor:'COMPLEX_INTERSECTION',policy:POLICY,axes:{TIME:{state:'accept_both',strength:1,maxRelativeIncrease:.2},DISTANCE:{state:'unconfirmed',strength:0}}}
const changed=applyQ4(fixture(),preference)
assert.equal(changed.recommended_index,1);assert.equal(changed.q4.changed,true);assert.deepEqual(changed.candidates,fixture().candidates);passed++
assert.equal(applyQ4(fixture(),{...preference,enabled:false}).recommended_index,0)
assert.equal(applyQ4(fixture(),{...preference,applicable:false}).recommended_index,0);passed++
const strong=fixture();strong.candidates[0].recommendation_score=.8;strong.candidates[1].recommendation_score=.2
assert.equal(applyQ4(strong,preference).recommended_index,0);passed++
const dominated=fixture();dominated.candidates[1].raw_features[0]=5
assert.equal(applyQ4(dominated,preference).recommended_index,0);passed++
const tooLong=fixture();tooLong.candidates[1].display_duration_s=1200
assert.equal(applyQ4(tooLong,preference).recommended_index,0);passed++
const short=fixture();short.recommended_index=1;short.candidates[0].recommendation_score=.49;short.candidates[1].recommendation_score=.51
assert.equal(applyQ4(short,{...preference,axes:{TIME:{state:'prefer_shorter',strength:1}}}).recommended_index,0);passed++
const fallback=fixture();fallback.recommendation_method='survey_fallback'
assert.equal(applyQ4(fallback,preference).q4.reason,'MODEL_UNAVAILABLE');passed++
const one=fixture();one.candidates=one.candidates.slice(0,1)
assert.equal(applyQ4(one,preference).q4.reason,'SINGLE_CANDIDATE');passed++
console.log({passed,scope:'Q4 interpretation and bounded recommendation policy; no efficacy claim'})
