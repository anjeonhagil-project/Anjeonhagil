// 기능: 브라우저 Supabase Auth client
// 주의: service_role/secret key를 절대 Frontend에 넣지 않음
import { createClient } from '@supabase/supabase-js'

// signUp/signInWithPassword/signInWithOAuth 등 Supabase Auth 호출에 쓰는 브라우저 client
export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
)
