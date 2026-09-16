// 불변 응답에서 정책 버전별 초기 시간·거리 프로필을 저장한다. 기존 완료 세션도 첫 조회에 재현 가능하게 해석한다.
import {supabase} from '../../lib/supabase.js'
import {interpretQ4,Q4_POLICY,POLICY} from './q4Policy.js'
async function value(query){const {data,error}=await query;if(error)throw error;return data}
export async function q4Profile(userId,surveyVersion){
    const user=await value(supabase.from('ag_user_profiles').select('q4_personalization_enabled').eq('user_id',userId).single())
    const session=await value(supabase.from('ag_q4_sessions').select('*').eq('user_id',userId).eq('survey_version',surveyVersion).maybeSingle())
    const empty={policy:POLICY,enabled:user.q4_personalization_enabled,applicable:false,axes:{},surveyVersion,sessionId:session?.session_id??null,status:'INCOMPLETE'}
    if(!session?.completed_at)return empty
    let stored=await value(supabase.from('ag_q4_profiles').select('interpretation').eq('session_id',session.session_id).eq('policy_version',Q4_POLICY).maybeSingle())
    if(!stored){
        const answers=await value(supabase.from('ag_q4_responses').select('question_index,answer').eq('session_id',session.session_id))
        if(answers.length!==4)return empty
        const interpretation=interpretQ4(session,answers)
        await value(supabase.from('ag_q4_profiles').upsert({session_id:session.session_id,policy_version:Q4_POLICY,user_id:userId,survey_version:surveyVersion,interpretation},{onConflict:'session_id,policy_version',ignoreDuplicates:true}))
        stored=await value(supabase.from('ag_q4_profiles').select('interpretation').eq('session_id',session.session_id).eq('policy_version',Q4_POLICY).single())
    }
    return {...stored.interpretation,enabled:user.q4_personalization_enabled,status:'COMPLETE'}
}
export async function setQ4Enabled(userId,enabled){
    if(typeof enabled!=='boolean')throw Object.assign(new Error('시간·거리 선호 설정을 확인해주세요'),{status:400})
    await value(supabase.rpc('ag_set_q4_enabled',{p_user:userId,p_enabled:enabled}))
    return {enabled}
}
export async function restartQ4(userId){return {surveyVersion:await value(supabase.rpc('ag_restart_q4',{p_user:userId}))}}
