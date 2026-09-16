// 기능(Anjeonhagil): 서버가 저장한 검색에 대한 실제 노출과 최종 선택 RPC 호출을 전담한다.
import { supabase } from '../../lib/supabase.js'

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
