// # 기능: 관리자 로그인용 Supabase Auth 브라우저 client
// # 주의: service_role/secret key를 절대 Frontend에 넣지 않음

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Supabase frontend 환경변수가 설정되지 않았습니다.'
    )
}

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
)