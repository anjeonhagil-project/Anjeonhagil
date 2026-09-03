// 기능: 회원가입 중복확인용 public.users 테이블 조회
import { supabase } from '../../lib/supabase.js'

async function existsBy(column, value) {
    const { count, error } = await supabase
        .from('users')
        .select('id', { head: true, count: 'exact' })
        .eq(column, value)

    if (error) throw error
    return count > 0
}

// 회원가입 시 이메일 중복 확인용
export function emailExists(email) {
    return existsBy('email', email)
}
