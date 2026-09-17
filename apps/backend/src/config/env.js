// 수정 필요(Anjeonhagil): 라우팅·모델 내부 API 주소/토큰/시간 제한을 검증하고 브라우저 환경변수와 분리한다.
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
