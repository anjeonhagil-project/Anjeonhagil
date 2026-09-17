import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {rowsFor,fitTrial,probability,FEATURES} from '../ml/q4-trial.mjs'
import {exportDataset} from '../ml/q4-export.mjs'
const bank=JSON.parse(readFileSync('apps/backend/src/config/q4Cases.json','utf8')),model=JSON.parse(readFileSync('ml/bundled/logistic.json','utf8'))
const report={scope:'deterministic numerical/contract tests, not real-user validation',factors:{},passed:0},contractFixtures=[]
const key='q4-test-key-not-for-real-user-exports'
for(const [f,questions] of Object.entries(bank.cases)){
    const weights=Object.keys(bank.cases).map(k=>Number(k===f))
    const session={session_id:f,user_id:'test',survey_version:'survey',case_set_version:bank.case_set_version,reference_source:'Q2_TOP',revision:1,completed_at:'2026-09-17T00:00:00Z',questions:questions.map(q=>({...q,routes:q.routes.map((r,i)=>({...r,label:i?'B':'A'}))}))}
    let minimum=2,maximum=.5,held=0,boundaries=0
    for(let pattern=0;pattern<81;pattern++){
        let n=pattern;const answers=questions.map((_,i)=>{const answer=['A','B','UNSURE'][n%3];n=Math.floor(n/3);return {question_index:i,answer}})
        const rows=rowsFor(session,answers,weights),fit=fitTrial(rows,model)
        for(const v of fit.multipliers){assert.ok(Number.isFinite(v)&&v>=.5&&v<=2);minimum=Math.min(v,minimum);maximum=Math.max(v,maximum)}
        if(fit.status==='HELD')held++;if(fit.boundary)boundaries++
        const flipped=structuredClone(session);flipped.questions.forEach(q=>q.routes.forEach(r=>{r.label=r.label==='A'?'B':'A'}))
        const flipAnswers=answers.map(a=>({...a,answer:a.answer==='A'?'B':a.answer==='B'?'A':'UNSURE'}))
        assert.deepEqual(fitTrial(rowsFor(flipped,flipAnswers,weights),model).multipliers,fit.multipliers)
        report.passed+=2
    }
    const answers=questions.map((_,i)=>({question_index:i,answer:'A'})),rows=rowsFor(session,answers,weights)
    const sensitivity=[.25,1,4].map(regularization=>({regularization,multipliers:fitTrial(rows,model,{regularization}).multipliers}))
    const ds=exportDataset([{session,answers,survey_weights:weights}],model,key)
    for(const [index,q] of session.questions.entries())contractFixtures.push({a:q.routes[0],b:q.routes[1],weights,x:rows[index].x,p:probability(rows[index],model)})
    assert.equal(ds.rows.length,4);assert.equal(ds.rows[0].x_base.length,8);assert.notEqual(ds.rows[0].user_id,'test');assert.equal('multipliers' in ds.rows[0],false)
    assert.throws(()=>rowsFor(session,[answers[0],answers[0]],weights),/DUPLICATE/)
    report.factors[f]={minimum,maximum,held,boundaries,sensitivity,trainingEligible:questions.every(q=>q.training_eligible===true)};report.passed+=4
}
const toy={...model,feature_order:FEATURES,scales:Array(8).fill(1),coefficients:Array(8).fill(-1)}
const basis=[{x:[1,0,-1,0,0,0,0,0],y:1},{x:[2,0,-2,0,0,0,0,0],y:1},{x:[0,1,-1,0,0,0,0,0],y:0},{x:[0,2,-2,0,0,0,0,0],y:0}]
const fit=fitTrial(basis,toy);assert.ok(fit.multipliers[0]<1&&fit.multipliers[1]>1)
assert.deepEqual(fitTrial(basis.map(r=>({...r,y:null})),toy).multipliers,[1,1])
assert.equal(fitTrial(basis.map(r=>({...r,x:[1,1,0,0,0,0,0,0]})),toy).reason,'WEAK_TIME_DISTANCE_IDENTIFICATION')
assert.throws(()=>fitTrial(basis,{...toy,scales:Array(8).fill(0)}),/CONTRACT/)
assert.equal(probability(basis[0],toy,[1,1]),.5);report.passed+=5
mkdirSync('docs/q4',{recursive:true});mkdirSync('.test-tools',{recursive:true});writeFileSync('.test-tools/q4-model-contract.json',JSON.stringify(contractFixtures));writeFileSync('docs/q4/trial-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
