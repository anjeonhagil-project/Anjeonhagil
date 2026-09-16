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
assert.equal(Object.keys(bank.cases).length,6)
for(const [factor,questions]of Object.entries(bank.cases)){
    assert.equal(questions.length,4)
    for(const q of questions){
        assert.equal(q.routes.length,2)
        const i=q.routes[0].factor_order.indexOf(factor)
        assert.ok(q.routes[0].raw_features[i]>q.routes[1].raw_features[i])
        assert.equal(q.lower_burden_route_key,q.routes[1].route_key)
        assert.equal(q.single_factor_isolated,false)
        for(const r of q.routes){assert.equal(r.display_duration_s,Math.round(r.internal_duration_s/60)*60);assert.equal(r.quality.production_route_approved,false)}
    }
    for(const [small,large,metric]of [[questions[0],questions[1],'display_duration_s'],[questions[2],questions[3],'distance_m']])assert.ok(small.routes[1][metric]-small.routes[0][metric]<large.routes[1][metric]-large.routes[0][metric])
}
const model=JSON.parse(readFileSync('ml/bundled/logistic.json','utf8'))
assert.equal(model.feature_order.length,8);assert.equal(model.with_mean,false);assert.equal(model.intercept,0)
console.log('PASS: preferences, search/event validation, 24 real Q4 cases, model schema')
