// 불변 응답에서 정책 버전별 초기 시간·거리 프로필을 저장한다. 기존 완료 세션도 첫 조회에 재현 가능하게 해석한다.
import {supabase} from '../../lib/supabase.js'
import {interpretQ4,Q4_POLICY,POLICY} from './q4Policy.js'
import {readFileSync} from 'node:fs'
import {fitTrial,rowsFor,VERSION,POLICY as TRIAL_POLICY} from '../../../../../ml/q4-trial.mjs'
let trialModel=null
try{trialModel=JSON.parse(readFileSync(new URL('../../../../../ml/bundled/logistic.json',import.meta.url),'utf8'))}catch{/* A missing trial model must not prevent survey completion or serving fallback. */}
async function value(query){const {data,error}=await query;if(error)throw error;return data}
export async function q4Profile(userId,surveyVersion,{includeTraining=true}={}){
    const user=await value(supabase.from('ag_user_profiles').select('q4_personalization_enabled').eq('user_id',userId).single())
    const query=()=>supabase.from('ag_q4_sessions').select('*').eq('user_id',userId).eq('survey_version',surveyVersion).order('revision',{ascending:false}).limit(1)
    const [session,latest,completed,requests]=await Promise.all([
        value(query().eq('case_set_version','q4_real_routes_20260917').not('completed_at','is',null).maybeSingle()),
        includeTraining?value(query().maybeSingle()):null,
        includeTraining?value(query().not('completed_at','is',null).maybeSingle()):null,
        includeTraining?value(supabase.from('ag_q4_retake_requests').select('survey_version').eq('user_id',userId).eq('survey_version',surveyVersion)):[],
    ])
    let training=null
    if(completed){
        let storedTrial=await value(supabase.from('ag_q4_trial_estimates').select('result').eq('session_id',completed.session_id).eq('estimator_version',VERSION).maybeSingle())
        if(!storedTrial){
            const answers=await value(supabase.from('ag_q4_responses').select('question_index,answer').eq('session_id',completed.session_id))
            const survey=await value(supabase.from('ag_preference_history').select('survey_weights').eq('survey_version',surveyVersion).single())
            const eligible=completed.reference_source==='Q2_TOP'&&completed.questions.every(q=>q.training_eligible===true)
            let result={policy:TRIAL_POLICY,status:'HELD',reason:'UNVALIDATED_BANK_OR_NO_Q2_REFERENCE',multipliers:[1,1]}
            if(eligible){
                if(!trialModel)result.reason='TRIAL_MODEL_UNAVAILABLE'
                else try{result=fitTrial(rowsFor(completed,answers,survey.survey_weights),trialModel)}catch{result.reason='TRIAL_CONTRACT_INVALID'}
            }
            await value(supabase.from('ag_q4_trial_estimates').upsert({session_id:completed.session_id,estimator_version:VERSION,result},{onConflict:'session_id,estimator_version',ignoreDuplicates:true}))
            storedTrial=await value(supabase.from('ag_q4_trial_estimates').select('result').eq('session_id',completed.session_id).eq('estimator_version',VERSION).single())
        }
        training={...storedTrial.result,sessionId:completed.session_id,revision:completed.revision}
    }
    // Preserve the pre-existing serving policy only for legacy sessions. Trial estimates never serve.
    const context={training,pending:!!latest&&!latest.completed_at||requests.length>0,revision:latest?.revision??null}
    const empty={policy:POLICY,enabled:user.q4_personalization_enabled,applicable:false,axes:{},surveyVersion,sessionId:completed?.session_id??null,status:completed?'COMPLETE':'INCOMPLETE',...context}
    if(!session)return empty
    let stored=await value(supabase.from('ag_q4_profiles').select('interpretation').eq('session_id',session.session_id).eq('policy_version',Q4_POLICY).maybeSingle())
    if(!stored){
        const answers=await value(supabase.from('ag_q4_responses').select('question_index,answer').eq('session_id',session.session_id))
        if(answers.length!==4)return empty
        const interpretation=interpretQ4(session,answers)
        await value(supabase.from('ag_q4_profiles').upsert({session_id:session.session_id,policy_version:Q4_POLICY,user_id:userId,survey_version:surveyVersion,interpretation},{onConflict:'session_id,policy_version',ignoreDuplicates:true}))
        stored=await value(supabase.from('ag_q4_profiles').select('interpretation').eq('session_id',session.session_id).eq('policy_version',Q4_POLICY).single())
    }
    return {...stored.interpretation,enabled:user.q4_personalization_enabled,status:'COMPLETE',...context}
}
export async function setQ4Enabled(userId,enabled){
    if(typeof enabled!=='boolean')throw Object.assign(new Error('시간·거리 선호 설정을 확인해주세요'),{status:400})
    await value(supabase.rpc('ag_set_q4_enabled',{p_user:userId,p_enabled:enabled}))
    return {enabled}
}
export async function restartQ4(userId){return {surveyVersion:await value(supabase.rpc('ag_restart_q4',{p_user:userId}))}}
