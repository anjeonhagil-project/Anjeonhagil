// # 기능: USER-001~004: 가입 완료/내정보/프로필수정/탈퇴 HTTP req/res 처리
import * as usersService from './users.service.js'

export async function getMe(req, res, next) {
    try {
        const user = await usersService.getMe(req.user.id)
        res.json({
            success: true,
            data: {
                userId: user.id,
                email: user.email,
                username: user.username,
                nickname: user.nickname,
                signupProvider: user.signup_provider,
                onboarding: user.onboarding,
                isActive: user.is_active,
            },
        })
    } catch (err) {
        next(err)
    }
}