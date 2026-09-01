// # 기능: Authorization: Bearer <Supabase Access Token> 검증
import { supabase } from '../lib/supabase.js'

// 토큰이 유효한 로그인 사용자인지 확인
export async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: { message: '인증 토큰이 없습니다' },
        })
    }

    const token = authHeader.slice('Bearer '.length)
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
        return res.status(401).json({
            success: false,
            error: { message: '유효하지 않거나 만료된 토큰입니다' },
        })
    }

    req.user = data.user
    next()
}