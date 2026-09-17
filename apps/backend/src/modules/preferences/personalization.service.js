// 설문·행동·적용 가중치를 구분하고 파일럿 정책의 이력 부족/검증 보류를 그대로 보여준다.
import {supabase} from '../../lib/supabase.js'
import {callWorker} from '../../routing-engine/routingClient.js'
import {q4Profile} from './q4Profile.service.js'
import {readFileSync} from 'node:fs'
const policy=JSON.parse(readFileSync(new URL('../../../../../ml/personalization_policy.json',import.meta.url),'utf8'))
async function value(query){const {data,error}=await query;if(error)throw error;return data}
export async function profile(userId) {
    const user=await value(supabase.from('ag_user_profiles').select('*').eq('user_id',userId).maybeSingle())
    if(!user)throw Object.assign(new Error('운전 부담 설문부터 완료해주세요'),{status:409})
    const current=await value(supabase.from('ag_profile_versions').select('*').eq('profile_version',user.active_profile_version).single())
    const survey=await value(supabase.from('ag_preference_history').select('survey_weights,ranks').eq('survey_version',current.survey_version).single())
    const jobs=await value(supabase.from('ag_profile_update_jobs').select('status,reason,evidence,finished_at,input_profile_version,result_profile_version').eq('user_id',userId).gte('created_at',user.history_start_at).order('created_at',{ascending:false}).limit(1))
    const accepted=await value(supabase.from('ag_profile_update_jobs').select('evidence').eq('result_profile_version',current.profile_version).maybeSingle())
    return {profileVersion:current.profile_version,surveyVersion:current.survey_version,surveyWeights:survey.survey_weights,q4:await q4Profile(userId,current.survey_version),
        effectiveWeights:current.effective_weights,behaviorWeights:accepted?.evidence?.behavior_weights??null,
        alpha:accepted?.evidence?.alpha??0,nEff:accepted?.evidence?.n_eff??0,enabled:user.personalization_enabled,
        historyStartAt:user.history_start_at,updatedAt:user.updated_at,reason:current.reason,latestJob:jobs[0]??null,
        policy:{version:policy.version,experimental:true,minimumSearches:policy.minimum_searches,windowSwitchSearches:policy.window_switch_searches,maximumSearches:policy.maximum_searches,halfLifeDays:policy.half_life_days,blendK:policy.blend_k},
        notice:'행동 보정은 파일럿 기능입니다. 최근 7일의 비교 가능한 선택이 10건 미만이면 30일 이력을 봅니다. 최소 4건을 적합·검증으로 나누고, 선호 차이가 있으며 검증 오차가 줄어들 때만 다음 검색에 적용합니다.'}
}
export async function reset(userId,enabled=null) {
    if(enabled!==null&&typeof enabled!=='boolean')throw Object.assign(new Error('개인화 설정을 확인해주세요'),{status:400})
    await value(supabase.rpc('ag_reset_profile',{p_user:userId,p_enabled:enabled}))
    return profile(userId)
}
export async function update(userId) {
    const state=await profile(userId)
    if(!state.enabled)return
    const cutoff=new Date(Math.max(Date.parse(state.historyStartAt),Date.now()-30*86400000)).toISOString()
    const choices=await value(supabase.from('ag_choices').select('*').eq('user_id',userId).gte('chosen_at',cutoff).order('chosen_at',{ascending:false}).limit(100))
    if(!choices.length)return
    const ids=choices.map(c=>c.search_id),exposureIds=choices.map(c=>c.exposure_id)
    const [searches,exposures,candidates]=await Promise.all([
        value(supabase.from('ag_searches').select('search_id,sample_origin,model_version').in('search_id',ids).eq('sample_origin','service')),
        value(supabase.from('ag_exposures').select('exposure_id,displayed_candidate_ids,context').in('exposure_id',exposureIds)),
        value(supabase.from('ag_candidates').select('candidate_id,search_id,snapshot').in('search_id',ids)),
    ])
    const model=await value(supabase.from('ag_model_versions').select('model_version').eq('is_active',true).eq('model_type','logistic').maybeSingle())
    if(!model)return
    const evidenceRows=choices.flatMap(choice=>{
        const s=searches.find(s=>s.search_id===choice.search_id),e=exposures.find(e=>e.exposure_id===choice.exposure_id)
        if(!s||!e||e.context?.policy!=='visible_cards_v2'||s.model_version!==model.model_version)return []
        const shown=e.displayed_candidate_ids.map(id=>candidates.find(c=>c.candidate_id===id)?.snapshot)
        if(shown.some(c=>!c)||shown.length<2)return []
        return [{sample_origin:'service',chosen_at:choice.chosen_at,candidates:shown.map(c=>({display_duration_s:c.display_duration_s,distance_m:c.distance_m,raw_features:c.raw_features,feature_version:c.feature_version,contract_version:c.contract_version,eta_version:c.eta_version})),selected_index:e.displayed_candidate_ids.indexOf(choice.selected_candidate_id)}]
    }).slice(0,20)
    const historyCutoff=choices[0].chosen_at
    const existing=await value(supabase.from('ag_profile_update_jobs').select('job_id,status,input_profile_version').eq('user_id',userId).eq('model_version',model.model_version).eq('history_cutoff',historyCutoff).order('created_at',{ascending:false}).limit(1))
    if(existing.length&&['accepted','held'].includes(existing[0].status))return
    let job=existing.find(j=>j.input_profile_version===state.profileVersion)
    if(job)await value(supabase.from('ag_profile_update_jobs').update({status:'running',finished_at:null,reason:null}).eq('job_id',job.job_id))
    else job=await value(supabase.from('ag_profile_update_jobs').insert({user_id:userId,input_profile_version:state.profileVersion,model_version:model.model_version,history_cutoff:historyCutoff,sample_search_count:evidenceRows.length,status:'running'}).select('job_id').single())
    try {
        const result=await callWorker('/personalize',{as_of:new Date().toISOString(),survey_weights:state.surveyWeights,current_weights:state.effectiveWeights,searches:evidenceRows})
        if(result.accepted) await value(supabase.rpc('ag_apply_profile_update',{p_job:job.job_id,p_weights:result.weights,p_before:result.before_loss,p_after:result.after_loss,p_evidence:result.evidence}))
        else await value(supabase.from('ag_profile_update_jobs').update({status:'held',reason:result.reason,evidence:result.evidence,before_loss:result.before_loss??null,after_loss:result.after_loss??null,finished_at:new Date().toISOString()}).eq('job_id',job.job_id).in('status',['running','queued']))
    } catch(error) {
        await value(supabase.from('ag_profile_update_jobs').update({status:'failed',reason:error.code||'PERSONALIZATION_FAILED',finished_at:new Date().toISOString()}).eq('job_id',job.job_id).in('status',['running','queued']))
        throw error
    }
}
let dispatching=false
export async function scheduleUpdate() {
    if(dispatching)return
    dispatching=true
    try {
        for(let i=0;i<20;i++){
            const job=await value(supabase.rpc('ag_claim_personalization'))
            if(!job)break
            let error=null
            try {await update(job.user_id)}catch(e){error=e.code||'PERSONALIZATION_FAILED'}
            await value(supabase.rpc('ag_finish_personalization',{p_user:job.user_id,p_token:job.lease_token,p_revision:job.revision,p_error:error}))
        }
    }catch(e){console.error('[profile dispatcher]',e.code||'failed')}
    finally{dispatching=false}
}
export function startPersonalizationDispatcher(){scheduleUpdate();const timer=setInterval(scheduleUpdate,10000);timer.unref();return ()=>clearInterval(timer)}
