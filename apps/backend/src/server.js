// # 기능: HTTP 서버 listen 시작점
import app from './app.js'
import { env } from './config/env.js'
import { checkSupabaseConnection } from './lib/supabase.js'

try {
    await checkSupabaseConnection()
    console.log('[server] Supabase 연결 완료')
} catch (err) {
    console.error('[server] Supabase 연결 실패:', err.message)
}

app.listen(env.port, () => {
    console.log(`[server] 안전하길 서버 실행 중... ${env.port}`)
})
