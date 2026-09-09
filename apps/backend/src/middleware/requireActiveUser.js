// 회원탈퇴 기능 파일


import { supabase } from '../lib/supabase.js'

// 로그인 토큰은 유효하지만 탈퇴 처리된 계정이면 사용자 API 접근 차단
export async function requireActiveUser(req, res, next) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('is_active')
            .eq('id', req.user.id)
            .maybeSingle()

        if (error) throw error

        if (!user || !user.is_active) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_WITHDRAWN',
                    message:
                        '탈퇴 처리된 계정입니다. 계정 복구 후 이용할 수 있습니다.',
                },
            })
        }

        next()
    } catch (error) {
        next(error)
    }
}