// Deterministic policy regression + sensitivity audit. No model fit or real-user efficacy claim.
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {BANK,POLICY,servingProfile,applyServingQ4} from '../apps/backend/src/modules/preferences/q4ServingPolicy.js'
import {applyQ4} from '../apps/backend/src/modules/preferences/q4Policy.js'
import {fitTrial,rowsFor,probability,pair,hash} from '../ml/q4-trial.mjs'
const bank=JSON.parse(readFileSync('apps/backend/src/config/q4Cases.json','utf8'))
const model=JSON.parse(readFileSync('ml/bundled/logistic.json','utf8'))
const factors=Object.keys(bank.cases)
let checks=0
const ok=(v,m)=>{assert.ok(v,m);checks++}
const session=f=>({session_id:'test',survey_version:'survey',revision:2,case_set_version:BANK,reference_factor:f,reference_source:'Q2_TOP',questions:bank.cases[f].map(q=>({...q,routes:q.routes.map((r,i)=>({...r,label:i?'B':'A'}))}))})
const result=(routes,weights)=>{
    const cards=routes.map(r=>({...r,raw_features:[...r.raw_features],factor_order:factors,recommendation_score:0}))
    for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const p=probability({x:pair(cards[i],cards[j],weights)},model);cards[i].recommendation_score+=p;cards[j].recommendation_score+=1-p}
    const scores=cards.map(c=>c.recommendation_score)
    return {candidates:cards,recommended_index:scores.indexOf(Math.max(...scores)),recommendation_method:'model_logistic',model:{model_version:model.model_version}}
}
// Real bank: every response pattern, including unsure, through unchanged estimator.
let patterns=0,available=0,held=0
for(const f of factors)for(let code=0;code<81;code++){
    const s=session(f),weights=factors.map(v=>Number(v===f));let n=code
    const answers=s.questions.map((_,i)=>{const answer=['A','B','UNSURE'][n%3];n=Math.floor(n/3);return {question_index:i,answer}})
    const trial=fitTrial(rowsFor(s,answers,weights),model)
    const pref={...servingProfile(s,trial,model),enabled:true}
    if(pref.applicable)available++;else held++
    const r=result(s.questions[0].routes,weights),original=JSON.stringify(r.candidates)
    applyQ4(r,pref)
    ok(JSON.stringify(r.candidates)===original,'Must not mutate model scores or features')
    ok(Number.isInteger(r.recommended_index)&&r.recommended_index>=0&&r.recommended_index<r.candidates.length)
    if(f==='MERGE_BRANCH'||answers.filter(a=>a.answer!=='UNSURE').length<3)ok(!pref.applicable)
    patterns++
}
// Constructed near-tie is intentional boundary coverage, not performance evidence.
const pref={enabled:true,applicable:true,policy:POLICY,referenceFactor:factors[0],modelVersion:model.model_version,multipliers:[2,1],utilitySlopes:[-.01,-.001],limits:[300,1500]}
const fixture=()=>({model:{model_version:model.model_version},recommendation_method:'model_logistic',recommended_index:0,candidates:[
    {display_duration_s:600,distance_m:2000,raw_features:[1,1,1,1,1,1],factor_order:factors,recommendation_score:.505},
    {display_duration_s:480,distance_m:2000,raw_features:[2,1,1,1,1,1],factor_order:factors,recommendation_score:.495}]})
let r=fixture();const original=structuredClone(r);applyQ4(r,pref);ok(r.q4.changed&&r.recommended_index===1);assert.deepEqual(r.candidates,original.candidates);checks++
for(const patch of [{enabled:false},{applicable:false},{multipliers:[1,1]},{modelVersion:'wrong'},{multipliers:[NaN,1]},{limits:[0,1500]}]){r=fixture();applyQ4(r,{...pref,...patch});ok(r.recommended_index===0)}
r=fixture();r.candidates[1].recommendation_score=.4;applyQ4(r,pref);ok(r.recommended_index===0,'Far score gap')
r=fixture();r.candidates[1].display_duration_s=600;r.candidates[1].distance_m=2100;applyQ4(r,{...pref,multipliers:[.5,.5]});ok(r.recommended_index===0,'Dominated candidate')
r=fixture();r.candidates[1].display_duration_s=720;applyQ4(r,{...pref,multipliers:[.5,1]});ok(r.recommended_index===0,'Longer route without target burden reduction')
r=fixture();r.candidates[1].display_duration_s=960;r.candidates[1].raw_features[0]=0;applyQ4(r,{...pref,multipliers:[.5,1]});ok(r.recommended_index===0,'Outside survey support')
r=fixture();r.candidates[1].display_duration_s=720;r.candidates[1].raw_features[0]=0;applyQ4(r,{...pref,multipliers:[.5,1]});ok(r.recommended_index===1,'Lower time sensitivity may favor burden reduction within cap')
// Model hash mismatch must never reuse estimates made with another calibration model.
const s=session(factors[0]),trial=fitTrial(rowsFor(s,s.questions.map((_,i)=>({question_index:i,answer:'A'})),[1,0,0,0,0,0]),model)
ok(!servingProfile(s,{...trial,modelHash:'stale'},model).applicable)
ok(!servingProfile({...s,reference_source:'DEFAULT_REFERENCE'},trial,model).applicable)

// Audit only non-test searches; no label-based parameter selection.
const events=JSON.parse(readFileSync('ml/data/q2_q4_fitted/synthetic_searches_q2_q4.json','utf8')).filter(e=>e.split!=='test')
const settings=[{maximumModelGap:.02,maximumBonus:.01},POLICY,{maximumModelGap:.08,maximumBonus:.04}]
const sweep=settings.map(p=>({...p,searches:0,applicable:0,changed:0,eligibleAlternatives:0,maximumAbsoluteBonus:0,reasons:{},maxScoreSacrifice:0,maxAddedSeconds:0,maxAddedMeters:0}))
for(const e of events){
    const f=e.q4_profile.reference_factor??factors[2],s=session(f)
    const t={...trial,status:e.q4_profile.status,modelHash:hash(model),multipliers:[e.q4_profile.m_time,e.q4_profile.m_distance],usable:e.q4_profile.usable_answers,design:e.q4_profile.design}
    s.reference_source=e.q4_profile.reference_factor?'Q2_TOP':'DEFAULT_REFERENCE'
    const p={...servingProfile(s,t,model),enabled:true}
    for(const a of sweep){
        const r=result(e.routes,e.weights),base=r.recommended_index,raw=JSON.stringify(r.candidates)
        applyServingQ4(r,p,{...POLICY,maximumModelGap:a.maximumModelGap,maximumBonus:a.maximumBonus})
        a.searches++;if(p.applicable)a.applicable++
        a.reasons[r.q4.reason]=(a.reasons[r.q4.reason]??0)+1
        a.eligibleAlternatives+=(r.q4.eligibleIndices?.length??1)-1
        a.maximumAbsoluteBonus=Math.max(a.maximumAbsoluteBonus,...(r.q4.policyBonuses??[0]).map(Math.abs))
        ok(raw===JSON.stringify(r.candidates))
        if(r.q4.changed){a.changed++;const b=r.candidates[base],c=r.candidates[r.recommended_index];const sacrifice=(b.recommendation_score-c.recommendation_score)/(r.candidates.length-1);ok(sacrifice<=a.maximumBonus+1e-12);a.maxScoreSacrifice=Math.max(a.maxScoreSacrifice,sacrifice);a.maxAddedSeconds=Math.max(a.maxAddedSeconds,c.display_duration_s-b.display_duration_s);a.maxAddedMeters=Math.max(a.maxAddedMeters,c.distance_m-b.distance_m)}
    }
}
const report={checks,patterns,available,held,policy:POLICY,sweep,scope:'Real bank structural checks + synthetic train/validation behavior audit; no real-user efficacy, no test-label tuning'}
mkdirSync('.test-tools',{recursive:true});writeFileSync('.test-tools/q4-serving-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
