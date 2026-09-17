// 한국 시간의 자정·연말·윤년 월말과 구간 중복 여부를 검사한다.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {validateInquiryId} from '../apps/backend/src/modules/admin/inquiries/inquiries.validation.js'
import {usageBuckets} from '../apps/backend/src/modules/admin/dashboard/usageBuckets.js'
const today=usageBuckets('today',new Date('2026-12-31T15:30:00Z'))
assert.equal(today.length,12)
assert.equal(today[0].start,'2026-12-31T15:00:00.000Z')
assert.equal(today.at(-1).end,'2027-01-01T15:00:00.000Z')
const leap=usageBuckets('month',new Date('2024-02-12T00:00:00Z'))
assert.equal(leap.length,29)
assert.equal(leap.at(-1).end,'2024-02-29T15:00:00.000Z')
const year=usageBuckets('year',new Date('2026-09-16T00:00:00Z'))
assert.equal(year.at(-1).end,'2026-12-31T15:00:00.000Z')
for(const values of [today,leap,year])for(let i=1;i<values.length;i++)assert.equal(values[i-1].end,values[i].start)
assert.throws(()=>usageBuckets('all'))
for(const [inquiryId,valid] of [[randomUUID(),true],['00000000-4000-8000-000000000000',false],['invalid',false]]){
    let error;validateInquiryId({params:{inquiryId}},{},e=>{error=e});assert.equal(!error,valid)
}
console.log('PASS: KST midnight, year rollover, leap month, contiguous buckets, invalid period')
