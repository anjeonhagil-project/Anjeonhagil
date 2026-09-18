// 내부 경로 탐색·검산·모델 확인·DB 저장을 완료한 응답만 화면에 보낸다.
import * as repository from './routes.repository.js'
import { supabase } from '../../lib/supabase.js'
import { searchRoutes, callWorker } from '../../routing-engine/routingClient.js'
import { validateCandidates } from '../../routing-engine/candidateValidation.js'
import { routeSnapshot } from './routeSnapshot.js'
import { scheduleUpdate, reset } from '../preferences/personalization.service.js'
import {q4Profile} from '../preferences/q4Profile.service.js'
import {applyQ4} from '../preferences/q4Policy.js'
import {createSearchQueue} from '../../routing-engine/searchQueue.js'
const queue=createSearchQueue()
export async function search(userId,input,{signal}={}) {
    const existing=await repository.findSearch(userId,input.searchId)
    if(existing) {
        if(existing.origin.lat!==input.origin.lat||existing.origin.lng!==input.origin.lng||existing.origin.heading!==input.origin.heading||existing.destination.lat!==input.destination.lat||existing.destination.lng!==input.destination.lng||existing.destination.heading!==input.destination.heading||Date.parse(existing.departureAt)!==Date.parse(input.departureAt)) throw Object.assign(new Error('검색 식별자가 다른 검색에서 사용되었습니다'),{status:409})
        return existing
    }
    const release=await queue.acquire(signal)
    const started=Date.now()
    try {
        signal?.throwIfAborted()
        const saved=await repository.findSearch(userId,input.searchId)
        if(saved){if(saved.origin.lat!==input.origin.lat||saved.origin.lng!==input.origin.lng||saved.origin.heading!==input.origin.heading||saved.destination.lat!==input.destination.lat||saved.destination.lng!==input.destination.lng||saved.destination.heading!==input.destination.heading||Date.parse(saved.departureAt)!==Date.parse(input.departureAt))throw Object.assign(new Error('검색 식별자가 다른 검색에서 사용되었습니다'),{status:409});return saved}
        const {data:current,error}=await supabase.from('ag_user_profiles').select('active_profile_version').eq('user_id',userId).maybeSingle()
        if(error) throw error
        if(!current) throw Object.assign(new Error('운전 부담 설정을 먼저 완료해주세요'),{status:409,code:'PREFERENCES_REQUIRED'})
        let {data:profile,error:pe}=await supabase.from('ag_profile_versions').select('*').eq('profile_version',current.active_profile_version).single()
        if(pe) throw pe
        const health=await callWorker('/health',undefined,{signal})
        if(profile.reason==='learned' && profile.model_version!==health.model.model_version) {
            const state=await reset(userId)
            const restored=await supabase.from('ag_profile_versions').select('*').eq('profile_version',state.profileVersion).single()
            if(restored.error)throw restored.error
            profile=restored.data
        }
        const result=await searchRoutes({origin:input.origin,destination:input.destination,departure_at:input.departureAt,profile_weights:profile.effective_weights},{signal})
        const validationStarted=Date.now()
        await validateCandidates(result,profile.effective_weights,{signal})
        result.diagnostics.validation_ms=Date.now()-validationStarted
        const {data:model,error:me}=await supabase.from('ag_model_versions').select('*').eq('model_version',result.model.model_version).maybeSingle()
        if(me) throw me
        if(!model||(!model.is_active&&result.recommendation_method!=='survey_fallback')||model.artifact_sha256!==result.model.artifact_sha256||model.scale_version!==result.model.scaler_version) throw Object.assign(new Error('DB와 실행 모델이 일치하지 않습니다. 모델 등록 상태를 확인해주세요.'),{status:503,code:'MODEL_REGISTRY_MISMATCH'})
        applyQ4(result,await q4Profile(userId,profile.survey_version,{includeTraining:false}))
        const payload=routeSnapshot(userId,input,profile,result)
        signal?.throwIfAborted()
        const saveStarted=Date.now()
        await repository.saveSearch(userId,payload)
        console.info('[route stages]',JSON.stringify({validation_ms:result.diagnostics.validation_ms,save_ms:Date.now()-saveStarted,total_ms:Date.now()-started}))
        return payload.response
    } catch(error) {
        if(signal?.aborted)throw error
        await supabase.from('ag_route_failures').insert({user_id:userId,search_id:input.searchId,error_code:error.code||'ROUTE_CALCULATION_FAILED',duration_ms:Math.max(0,Date.now()-started)})
        throw error
    } finally {release()}
}
export async function recordExposure(userId,input) {
    const e=await repository.recordExposure(userId,input)
    return {exposureId:e.exposure_id,searchId:e.search_id,candidateIds:e.displayed_candidate_ids,recommendedCandidateId:e.recommended_candidate_id,exposedAt:e.exposed_at}
}
export async function recordChoice(userId,input) {
    const c=await repository.recordChoice(userId,input)
    scheduleUpdate(userId)
    return {choiceEventId:c.choice_event_id,exposureId:c.exposure_id,searchId:c.search_id,selectedCandidateId:c.selected_candidate_id,chosenAt:c.chosen_at}
}
export async function detail(userId,searchId) {
    const result=await repository.findSearch(userId,searchId)
    if(!result) throw Object.assign(new Error('검색 결과를 찾을 수 없습니다'),{status:404})
    return result
}
export async function burden(userId,searchId,candidateId) {
    const snapshot=await detail(userId,searchId)
    const candidate=snapshot.candidates.find(c=>c.candidate_id===candidateId)
    if(!candidate)throw Object.assign(new Error('검색에 포함된 경로를 찾을 수 없습니다'),{status:404,expose:true})
    return callWorker('/burden',{...snapshot.versions,segments:candidate.segments,raw_features:candidate.raw_features})
}
export async function history(userId) {return repository.history(userId)}

// Guidance is derived on demand, including old snapshots, without changing choice logs.
export async function guidance(userId,searchId) {
    const snapshot=await detail(userId,searchId)
    const candidate=snapshot.candidates.find(c=>c.candidate_id===snapshot.selectedCandidateId)
    if(!candidate)throw Object.assign(new Error('먼저 안내할 경로를 선택해주세요.'),{status:409,expose:true})
    const instructions=await callWorker('/guidance',{...snapshot.versions,segments:candidate.segments})
    return {searchId,origin:snapshot.origin,destination:snapshot.destination,candidate,...instructions}
}
