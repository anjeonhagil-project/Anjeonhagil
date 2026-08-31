// # 기능: Backend DB 접근용 Supabase server client
import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

// users 테이블에 count-only 쿼리를 날려 Supabase 연결/인증이 정상인지 확인
export async function checkSupabaseConnection() {
    const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' })
    if (error) throw error
}

export const supabase = createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
})
