// 기능(Anjeonhagil): 최신 설문·온보딩 진행 조회와 ag_save_preferences RPC 호출을 전담한다.
import { supabase } from '../../lib/supabase.js'

export async function findByUserId(userId) {
    const { data: current, error: currentError } = await supabase
        .from('ag_preferences')
        .select('survey_version, updated_at')
        .eq('user_id', userId)
        .maybeSingle()

    if (currentError) throw currentError
    if (!current) return null

    const [historyResult, onboardingResult] = await Promise.all([
        supabase
            .from('ag_preference_history')
            .select('survey_version, driving_frequency, ranks, survey_weights, max_detour_minutes, created_at')
            .eq('user_id', userId)
            .eq('survey_version', current.survey_version)
            .single(),
        supabase
            .from('ag_onboarding_progress')
            .select('survey_version, case_set_version, required_case_ids, completed_at, created_at')
            .eq('user_id', userId)
            .maybeSingle(),
    ])

    if (historyResult.error) throw historyResult.error
    if (onboardingResult.error) throw onboardingResult.error

    return {
        ...historyResult.data,
        updated_at: current.updated_at,
        onboarding: onboardingResult.data,
    }
}

export async function save(userId, answers) {
    const { data, error } = await supabase.rpc('ag_save_preferences', {
        p_user: userId,
        p_frequency: answers.drivingFrequency,
        p_ranks: answers.ranks,
        p_q3: answers.maxDetourMinutes,
    })

    if (error) throw error
    return data
}
