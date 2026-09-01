// # 기능: USER-001~004: 가입 완료/내정보/프로필수정/탈퇴 DB query 전담
import { supabase } from '../../lib/supabase.js'

export async function findById(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('id, email, username, nickname, signup_provider, onboarding, is_active')
        .eq('id', userId)
        .single()

    if (error) throw error
    return data
}