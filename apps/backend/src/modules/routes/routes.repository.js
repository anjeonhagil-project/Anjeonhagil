// 기능(Anjeonhagil): 서버가 저장한 검색에 대한 실제 노출과 최종 선택 RPC 호출을 전담한다.
import { supabase } from '../../lib/supabase.js'

export async function saveSearch(userId,payload) {
    const {error}=await supabase.rpc('ag_save_search',{p_user:userId,p_payload:payload})
    if(error) throw error
}
export async function findSearch(userId,searchId) {
    if(!searchId) return null
    const {data,error}=await supabase.from('ag_searches').select('response_snapshot').eq('user_id',userId).eq('search_id',searchId).maybeSingle()
    if(error) throw error
    if(!data) return null
    const {data:choice,error:ce}=await supabase.from('ag_choices').select('selected_candidate_id,chosen_at').eq('search_id',searchId).eq('user_id',userId).maybeSingle()
    if(ce) throw ce
    return {...data.response_snapshot,selectedCandidateId:choice?.selected_candidate_id??null,chosenAt:choice?.chosen_at??null}
}
export async function history(userId) {
    const {data,error}=await supabase.from('ag_searches').select('search_id,origin,destination,created_at').eq('user_id',userId).eq('sample_origin','service').order('created_at',{ascending:false}).limit(20)
    if(error) throw error
    if(!data.length)return []
    const {data:choices,error:ce}=await supabase.from('ag_choices').select('search_id,selected_candidate_id,chosen_at').eq('user_id',userId).in('search_id',data.map(s=>s.search_id))
    if(ce)throw ce
    return data.map(s=>({...s,choice:choices.find(c=>c.search_id===s.search_id)??null}))
}

export async function recordExposure(userId, { searchId, exposureId, candidateIds, recommendedCandidateId }) {
    const { data, error } = await supabase.rpc('ag_record_exposure', {
        p_user: userId,
        p_search: searchId,
        p_exposure: exposureId,
        p_ids: candidateIds,
        p_recommended: recommendedCandidateId ?? null,
    })

    if (error) throw error
    return data
}

export async function recordChoice(userId, { exposureId, choiceEventId, selectedCandidateId }) {
    const { data, error } = await supabase.rpc('ag_record_choice', {
        p_user: userId,
        p_exposure: exposureId,
        p_choice: choiceEventId,
        p_selected: selectedCandidateId,
    })

    if (error) throw error
    return data
}
