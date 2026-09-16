// 기능: USER-001~004: 가입 완료/내정보/프로필수정/탈퇴 DB query 전담
import { supabase } from '../../lib/supabase.js'

// 내 정보 조회
export async function findById(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('id, email, username, nickname, signup_provider, onboarding, is_active')
        .eq('id', userId)
        .single()

    if (error) throw error
    return data
}

// 약관 동의 상태 조회
export async function findTermsAgreement(userId) {
    const { data, error } = await supabase
        .from('user_term_agreements')
        .select('agreed_at')
        .eq('user_id', userId)
        .maybeSingle()

    if (error) throw error
    return data
}

// 약관 동의 저장 (idempotent upsert)
export async function upsertTermsAgreement(userId) {
    const { data, error } = await supabase
        .from('user_term_agreements')
        .upsert({ user_id: userId, agreed_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select('agreed_at')
        .single()

    if (error) throw error
    return data
}

// 마이페이지 - 프로필 관리
export async function updateNickname(userId, nickname) {
    const { data, error } = await supabase
        .from('users')
        .update({ nickname })
        .eq('id', userId)
        .select('id, nickname')
        .single()

    if (error) throw error
    return data
}

// 회원탈퇴: 즉시 로그인·서비스 이용을 막고, 30일 뒤 정리 대상으로 표시
export async function withdrawUser(userId) {
    const { data, error } = await supabase
        .from('users')
        .update({
            is_active: false,
            withdrawn_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('is_active', true)
        .select('id, withdrawn_at')
        .maybeSingle()

    if (error) throw error
    return data
}

// 탈퇴 계정도 복구 안내를 위해 최소 상태만 조회
export async function findAccountStatus(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('is_active, withdrawn_at')
        .eq('id', userId)
        .maybeSingle()

    if (error) throw error
    return data
}

// 탈퇴 유예 기간 안에 계정을 다시 활성화
export async function restoreUser(userId) {
    const { data, error } = await supabase
        .from('users')
        .update({
            is_active: true,
            withdrawn_at: null,
        })
        .eq('id', userId)
        .eq('is_active', false)
        .select('id, is_active, withdrawn_at')
        .maybeSingle()

    if (error) throw error
    return data
}

// 새 설문 존재와 Q4 완료 기록을 함께 조회해 구 users.onboarding 값만으로 완료를 판단하지 않는다.
export async function findOnboardingState(userId) {
    const [preferencesResult, progressResult] = await Promise.all([
        supabase
            .from('ag_preferences')
            .select('survey_version')
            .eq('user_id', userId)
            .maybeSingle(),
        supabase
            .from('ag_onboarding_progress')
            .select('completed_at')
            .eq('user_id', userId)
            .maybeSingle(),
    ])

    if (preferencesResult.error) throw preferencesResult.error
    if (progressResult.error) throw progressResult.error

    return {
        surveyCompleted: Boolean(preferencesResult.data),
        routeChoicesCompleted: Boolean(progressResult.data?.completed_at),
        completedAt: progressResult.data?.completed_at ?? null,
    }
}
