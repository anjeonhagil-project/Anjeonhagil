// # 기능: public.admins의 is_active/role을 확인하여 관리자 API 보호

import { supabase } from '../lib/supabase.js'

export async function requireAdmin(req, res, next) {
    try {
        // authenticate middleware를 먼저 통과했는지 확인
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                error: {
                    message: '인증된 사용자 정보가 없습니다',
                },
            })
        }

        // Supabase Auth 사용자 ID와 동일한 관리자 정보 조회
        const { data: admin, error } = await supabase
            .from('admins')
            .select('id, email, role, is_active')
            .eq('id', req.user.id)
            .maybeSingle()

        if (error) {
            return next(error)
        }

        // admins 테이블에 등록되지 않은 일반 사용자
        if (!admin) {
            return res.status(403).json({
                success: false,
                error: {
                    message: '관리자 권한이 없습니다',
                },
            })
        }

        // 관리자 권한이 비활성화된 계정
        if (!admin.is_active) {
            return res.status(403).json({
                success: false,
                error: {
                    message: '비활성화된 관리자 계정입니다',
                },
            })
        }

        // 다음 middleware/controller에서 관리자 정보를 사용할 수 있도록 저장
        req.admin = admin

        next()
    } catch (err) {
        next(err)
    }
}