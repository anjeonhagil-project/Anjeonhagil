// 표시 설명은 실제 snapshot 차이만 사용하고, 0 기준값/미선택 요소를 과장하지 않는지 확인한다.
import assert from 'node:assert/strict'
import {compareRoute} from '../apps/frontend_mobile/src/features/routes/routeComparison.js'
const base={candidate_id:'base',route_types:['SHORTEST_TIME'],display_duration_s:300,distance_m:1000,raw_features:[10,0,20,2,1,100]}
const candidate={...base,candidate_id:'other',route_types:['PERSONALIZED'],display_duration_s:360,distance_m:1200,raw_features:[5,1,25,0,0,50]}
assert.equal(compareRoute(base,[base,candidate]),null)
assert.equal(compareRoute(candidate,[candidate]),null)
assert.deepEqual(compareRoute(candidate,[base,candidate],[1,1,1,0,0,1]),{minutes:1,meters:200,reductions:[{index:0,percent:50},{index:5,percent:50}],increases:[{index:2,delta:5,percent:25},{index:1,delta:1,percent:null}]})
assert.deepEqual(compareRoute(candidate,[base,candidate],[0,0,0,0,0,0]).reductions,[])
assert.equal(compareRoute({...candidate,display_duration_s:300,distance_m:1000},[base,candidate]).minutes,0)
console.log('PASS: 5 route comparison cases')
