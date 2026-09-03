// # 기능: 아이디/이메일 중복확인 HTTP req/res 처리
import * as authService from './auth.service.js'

// 회원가입 시 이메일 중복 확인용
export async function checkEmail(req, res, next) {
    try {
        const result = await authService.checkEmail(req.query.value ?? '')
        res.json({ success: true, data: result })
    } catch (err) {
        next(err)
    }
}
