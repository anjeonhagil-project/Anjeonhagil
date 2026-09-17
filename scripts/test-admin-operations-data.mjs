import assert from 'node:assert/strict'
import {normalizeOperationsData} from '../apps/frontend_admin/src/features/dashboard/operationsData.js'

const summary={releases:[{release_id:'release-1'}],models:[{model_version:'model-1'}],active:null}
assert.deepEqual(normalizeOperationsData('datasets',summary),summary)
assert.throws(()=>normalizeOperationsData('datasets',{models:[]}),/도로 데이터 목록/)
assert.throws(()=>normalizeOperationsData('datasets',{releases:[]}),/추천 모델 목록/)
assert.throws(()=>normalizeOperationsData('datasets',null),/응답 형식/)

const rows=[{searchId:'search-1'}]
assert.deepEqual(normalizeOperationsData('routes',rows),rows)
assert.deepEqual(normalizeOperationsData('failures',[]),[])
assert.throws(()=>normalizeOperationsData('routes',{}),/기록 목록/)

console.log(JSON.stringify({passed:7}))
