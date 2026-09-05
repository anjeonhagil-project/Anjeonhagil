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