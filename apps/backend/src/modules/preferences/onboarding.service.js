// Q4는 실제 경로 기반 설문 4문항이며 실제 선택·행동학습과 분리한다.
import { readFile } from 'node:fs/promises'
import { randomInt } from 'node:crypto'
import { supabase } from '../../lib/supabase.js'
import { FACTOR_ORDER } from '../../routing-engine/routingContract.js'
import {q4Profile} from './q4Profile.service.js'
async function progress(session) {
    const {data,error}=await supabase.from('ag_q4_responses').select('question_index,answer,answered_at').eq('session_id',session.session_id).order('question_index')
    if(error) throw error
    return {...session,answers:data,q4AffectsRecommendation:true,q4Profile:session.completed_at?await q4Profile(session.user_id,session.survey_version):null}
}
export async function items(userId) {
    const {data:cur,error}=await supabase.from('ag_preferences').select('survey_version').eq('user_id',userId).maybeSingle()
    if(error) throw error
    if(!cur) throw Object.assign(new Error('기본 설문부터 완료해주세요'),{status:409})
    const {data:session,error:se}=await supabase.from('ag_q4_sessions').select('*').eq('user_id',userId).eq('survey_version',cur.survey_version).maybeSingle()
    if(se) throw se
    if(session) return progress(session)
    const {data:history,error:he}=await supabase.from('ag_preference_history').select('ranks').eq('survey_version',cur.survey_version).single()
    if(he) throw he
    const top=history.ranks.indexOf(1),reference=FACTOR_ORDER[top<0?2:top]
    let bank
    try {bank=JSON.parse(await readFile(new URL('../../config/q4Cases.json',import.meta.url),'utf8'))}
    catch {throw Object.assign(new Error('검증된 비교 설문 자료를 준비 중입니다. 잠시 후 다시 시도해주세요.'),{status:503,code:'Q4_DATA_UNAVAILABLE'})}
    const questions=bank.cases[reference].map(q=>{
        const routes=randomInt(2)?[...q.routes].reverse():q.routes
        return {...q,routes:routes.map((r,i)=>({...r,label:i?'B':'A'}))}
    })
    const {data,error:be}=await supabase.rpc('ag_begin_q4',{p_user:userId,p_survey:cur.survey_version,p_case_set:bank.case_set_version,p_reference:reference,p_source:top<0?'DEFAULT_REFERENCE':'Q2_TOP',p_questions:questions})
    if(be) throw be
    return progress(data)
}
export async function answer(userId,body) {
    if(!body||typeof body.sessionId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.sessionId)||!Number.isInteger(body.questionIndex)||body.questionIndex<0||body.questionIndex>3||!['A','B','UNSURE'].includes(body.answer)) throw Object.assign(new Error('설문 응답을 확인해주세요'),{status:400})
    const {data,error}=await supabase.rpc('ag_answer_q4',{p_user:userId,p_session:body.sessionId,p_index:body.questionIndex,p_answer:body.answer})
    if(error) throw error
    if(data.completed){
        const {data:session,error:se}=await supabase.from('ag_q4_sessions').select('survey_version').eq('session_id',body.sessionId).eq('user_id',userId).single()
        if(se)throw se
        data.q4Profile=await q4Profile(userId,session.survey_version)
    }
    return data
}
