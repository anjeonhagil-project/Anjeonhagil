import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {synthesizeProfile,synthesizeProfiles} from '../ml/q4-synthetic-profiles.mjs'

const bank=JSON.parse(await readFile(new URL('../apps/backend/src/config/q4Cases.json',import.meta.url),'utf8'))
const model=JSON.parse(await readFile(new URL('../ml/bundled/logistic.json',import.meta.url),'utf8'))

const input={
    searchId:17,
    responseSeed:20260918,
    referenceFactor:'COMPLEX_INTERSECTION',
    referenceSource:'Q2_TOP',
    questions:bank.cases.COMPLEX_INTERSECTION,
    q2Weights:[0.4,0.2,0.15,0.1,0.1,0.05],
    latentMultipliers:[1.5,0.75]
}

const first=synthesizeProfile(input,model)
const replay=synthesizeProfile(input,model)

assert.deepEqual(replay,first,'같은 search와 seed는 완전히 같은 합성 Q4 profile을 재현해야 한다')
assert.equal(first.responses.length,4,'Q4 비교 문항 네 개에 모두 응답해야 한다')
assert(first.responses.every((answer,index)=>answer.question_index===index&&['A','B'].includes(answer.answer)),
    '합성 응답은 문항 순서대로 A 또는 B여야 한다')
assert.equal(first.status,'TRIAL_ONLY','적격 문항과 네 개의 유효 응답은 실제 fitTrial 계산을 통과해야 한다')
assert.equal(first.reason,'REGULARIZED_CONDITIONAL_FIT')
assert(first.multipliers.every(value=>value>=0.5&&value<=2),'계산 multiplier는 [0.5, 2] 범위여야 한다')
assert.notDeepEqual(first.multipliers,input.latentMultipliers,
    '학습 입력에는 숨은 정답을 복사하지 않고 네 응답으로 다시 추정한 multiplier를 사용해야 한다')

const noQ2=synthesizeProfile({...input,referenceSource:'DEFAULT_REFERENCE'},model)
assert.deepEqual(noQ2.multipliers,[1,1],'Q2 우선순위가 없으면 중립 multiplier로 fallback해야 한다')
assert.equal(noQ2.status,'HELD')
assert.equal(noQ2.reason,'UNVALIDATED_BANK_OR_NO_Q2_REFERENCE')

const ineligible=synthesizeProfile({
    ...input,
    referenceFactor:'MERGE_BRANCH',
    questions:bank.cases.MERGE_BRANCH
},model)
assert.deepEqual(ineligible.multipliers,[1,1],'학습 제외 문항이면 중립 multiplier로 fallback해야 한다')
assert.equal(ineligible.status,'HELD')
assert.equal(ineligible.reason,'UNVALIDATED_BANK_OR_NO_Q2_REFERENCE')

const batch=synthesizeProfiles([
    {
        searchId:17,responseSeed:20260918,referenceFactor:'COMPLEX_INTERSECTION',referenceSource:'Q2_TOP',
        q2Weights:input.q2Weights,latentMultipliers:input.latentMultipliers
    },
    {
        searchId:18,responseSeed:20260918,referenceFactor:'NARROW_ROAD',referenceSource:'DEFAULT_REFERENCE',
        q2Weights:[0,0,0,0,0,0],latentMultipliers:[1.2,1.1]
    }
],bank,model)
assert.equal(batch.length,2)
assert.equal(batch[0].searchId,17)
assert.equal(batch[0].responses.length,4)
assert.equal(batch[1].searchId,18)
assert.deepEqual(batch[1].multipliers,[1,1])

console.log('PASS: deterministic four-answer Q4 synthesis, automatic fit, fallbacks, and batch API')
