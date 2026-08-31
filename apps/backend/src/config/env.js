// # 기능: 서버 환경변수 존재 여부/형식 검증 후 export
import 'dotenv/config'

const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY']

for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`[env] 필수 환경변수 누락: ${key}`)
    }
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
}
