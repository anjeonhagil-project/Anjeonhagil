// 검증된 계산값과 프로필·모델·표시 순서를 불변 snapshot으로 만든다.
import { randomUUID } from 'node:crypto'
import { VERSIONS, RELEASE_ID } from '../../routing-engine/routingContract.js'
export function routeSnapshot(userId,input,profile,result) {
    const searchId=input.searchId||randomUUID()
    const profileSnapshot={profile_version:profile.profile_version,survey_version:profile.survey_version,effective_weights:profile.effective_weights}
    const candidates=result.candidates.map(c=>({...c,candidate_id:randomUUID(),search_id:searchId,user_id:userId,release_id:RELEASE_ID,
        ...VERSIONS,profile_version:profile.profile_version,model_version:result.model.model_version,scale_version:result.model.scaler_version,
        scaler_sha256:result.model.scaler_sha256,artifact_sha256:result.model.artifact_sha256}))
    const response={searchId,origin:input.origin,destination:input.destination,departureAt:result.departure_at,candidates,
        recommendedCandidateId:candidates[result.recommended_index].candidate_id,recommendationMethod:result.recommendation_method,
        model:{version:result.model.model_version,trainingSource:result.model.training_source,realUserValidated:false},
        degraded:result.degraded,diagnostics:result.diagnostics,profile:profileSnapshot,
        q4:result.q4?{...result.q4,baselineCandidateId:candidates[result.q4.baselineIndex].candidate_id,finalCandidateId:candidates[result.recommended_index].candidate_id}:null,
        notice:'과거 시간대별 교통자료를 사용한 예상값입니다. 실제 교통·사고 위험을 보장하지 않습니다.',versions:VERSIONS}
    return {search:{search_id:searchId,release_id:RELEASE_ID,profile_version:profile.profile_version,model_version:result.model.model_version,
        departure_at:result.departure_at,origin:input.origin,destination:input.destination,minimum_internal_duration_s:result.minimum_internal_duration_s,
        profile_snapshot:profileSnapshot,versions:VERSIONS,sample_origin:'service'},candidates,response}
}
