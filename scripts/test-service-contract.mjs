// 빠른 계약 회귀: Q3 제거·잘못된 입력·이벤트 UUID·Q4 실제 비교 조건·모델 스키마를 확인한다.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {validateSearchInput,validateExposureInput,validateChoiceInput} from '../apps/backend/src/modules/routes/routes.validation.js'
import {validateDrivingPreferences} from '../apps/backend/src/modules/preferences/preferences.validation.js'
import {validatePreferences,normalizePreferences} from '../apps/frontend_mobile/src/features/preferences/preferenceFields.js'
const valid={drivingFrequency:'weekly',ranks:[2,0,1,0,0,3]}
function preferenceError(body){let error;validateDrivingPreferences({body},{},e=>{error=e});return error}
assert.equal(preferenceError(valid),undefined)
assert.ok(preferenceError({...valid,maxDetourMinutes:null}))
assert.ok(preferenceError({...valid,ranks:[1,1,0,0,0,0]}))
assert.ok(preferenceError({...valid,ranks:[1,3,0,0,0,0]}))
assert.ok(preferenceError({...valid,ranks:[true,0,0,0,0,0]}))
assert.equal(preferenceError({...valid,ranks:[0,0,0,0,0,0]}),undefined)
assert.equal(validatePreferences(valid),'')
assert.equal(Object.hasOwn(normalizePreferences(valid),'maxDetourMinutes'),false)
const input={searchId:randomUUID(),origin:{lat:37.51,lng:127.03},destination:{lat:37.5,lng:127.04},departureAt:'2026-09-16T08:00:00+09:00'}
assert.deepEqual(validateSearchInput(input),input)
for(const change of [{raw_features:[]},{departureAt:'2026-09-16T08:00:00'},{origin:{lat:null,lng:127}},{origin:{lat:95,lng:127}},{searchId:'other'}])assert.throws(()=>validateSearchInput({...input,...change}))
const candidate=randomUUID(),exposure=randomUUID()
assert.throws(()=>validateExposureInput(input.searchId,{exposureId:exposure,candidateIds:[candidate,candidate]}))
assert.throws(()=>validateExposureInput(input.searchId,{exposureId:exposure,candidateIds:[candidate],recommendedCandidateId:randomUUID()}))
assert.equal(validateChoiceInput(exposure,{choiceEventId:randomUUID(),selectedCandidateId:candidate}).selectedCandidateId,candidate)
const bank=JSON.parse(readFileSync('apps/backend/src/config/q4Cases.json','utf8'))
const scales=JSON.parse(readFileSync('ml/bundled/logistic.json','utf8')).scales.slice(2)
assert.equal(Object.keys(bank.cases).length,6)
for(const [factor,questions]of Object.entries(bank.cases)){
    assert.equal(questions.length,4)
    const signatures=new Set()
    for(const q of questions){
        assert.equal(q.routes.length,2)
        const i=q.routes[0].factor_order.indexOf(factor)
        assert.ok(q.routes[0].raw_features[i]>q.routes[1].raw_features[i])
        assert.equal(q.lower_burden_route_key,q.routes[1].route_key)
        assert.equal(q.single_factor_isolated,false)
        const [a,b]=q.routes,improvement=a.raw_features[i]-b.raw_features[i]
        assert.ok(improvement+1e-9>=[1,100,100,1,2,50][i],`${factor}: insufficient burden contrast`)
        assert.ok(improvement/a.raw_features[i]>=.2)
        assert.ok(improvement/scales[i]>=.5)
        const other=a.raw_features.reduce((sum,x,j)=>sum+(j===i?0:Math.abs(x-b.raw_features[j])/scales[j]),0)
        assert.ok(other/(improvement/scales[i])<=(q.training_eligible?1:3))
        const arcsA=new Set(a.segments.map(s=>s.arc_id)),arcsB=new Set(b.segments.map(s=>s.arc_id))
        assert.ok([...arcsA].filter(x=>arcsB.has(x)).length/new Set([...arcsA,...arcsB]).size<=.8)
        assert.equal(a.departure_at,b.departure_at)
        const signature=q.routes.map(r=>[r.display_duration_s,Math.round(r.distance_m/10),Math.round(r.raw_features[i])].join(':')).join('|')
        assert.ok(!signatures.has(signature),'same displayed comparison repeated');signatures.add(signature)
        const delta=b[q.dimension==='TIME'?'display_duration_s':'distance_m']-a[q.dimension==='TIME'?'display_duration_s':'distance_m']
        const [min,max]=q.level==='COMPARISON'?(q.dimension==='TIME'?[60,300]:[100,1500]):q.dimension==='TIME'?(q.level==='SMALL'?[60,60]:[120,600]):(q.level==='SMALL'?[100,350]:[450,1500])
        assert.ok(delta>=min&&delta<=max)
        for(const r of q.routes){assert.equal(r.display_duration_s,Math.round(r.internal_duration_s/60)*60);assert.equal(r.quality.production_route_approved,false)}
    }
    if(questions.every(q=>q.training_eligible)){
        assert.equal(questions.filter(q=>q.dimension==='TIME').length,2)
        assert.equal(questions.filter(q=>q.dimension==='DISTANCE').length,2)
    }else assert.ok(questions.every(q=>q.training_eligible===false&&q.training_hold_reason))
}
const model=JSON.parse(readFileSync('ml/bundled/logistic.json','utf8'))
assert.equal(model.feature_order.length,8);assert.equal(model.with_mean,false);assert.equal(model.intercept,0)
console.log('PASS: preferences, search/event validation, 24 real Q4 cases, model schema')
