// 저장 전 부분 arc를 재계산해 raw6·거리·시간·프로필 불일치를 거절한다.
import { callWorker } from './routingClient.js'
import { VERSIONS, FACTOR_ORDER, FACTOR_UNITS as UNITS } from './routingContract.js'
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export async function validateCandidates(result,weights) {
    const fail=()=>{throw Object.assign(new Error('경로 계산 검증을 통과하지 못했습니다'),{status:503,code:'INVALID_ROUTE_SNAPSHOT'})}
    if(!Array.isArray(result.candidates)||result.candidates.length<1||result.candidates.length>3||!equal(result.profile_weights,weights)) fail()
    const seen=new Set()
    for(const c of result.candidates) {
        const key=JSON.stringify(c.segments)
        if(seen.has(key)||!equal(c.factor_order,FACTOR_ORDER)||!equal(c.units,UNITS)||!equal(c.profile_weights,weights)) fail()
        seen.add(key)
        if(![c.distance_m,c.internal_duration_s].every(x=>Number.isFinite(x)&&x>0)||c.display_duration_s!==Math.round(c.internal_duration_s/60)*60) fail()
        const checked=await callWorker('/evaluate',{...VERSIONS,departure_at:result.departure_at,segments:c.segments})
        if(Math.abs(c.distance_m-checked.distance_m)>.001||Math.abs(c.internal_duration_s-checked.internal_duration_s)>.001||c.raw_features.length!==6||c.raw_features.some((v,i)=>!Number.isFinite(v)||v<0||Math.abs(v-checked.raw_features[i])>.001)) fail()
        if(Math.abs(c.raw_features[5]-c.quality.child_circle_inside_m)>.001) fail()
    }
    if(!Number.isInteger(result.recommended_index)||!result.candidates[result.recommended_index]) fail()
}
