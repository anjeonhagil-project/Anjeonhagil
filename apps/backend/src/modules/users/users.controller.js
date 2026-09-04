// 기능: USER-001~004: 가입 완료/내정보/프로필수정/탈퇴 HTTP req/res 처리
import * as usersService from './users.service.js'

// 내 정보 조회
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

// 약관 동의 상태 조회
export async function getTerms(req, res, next) {
    try {
        const result = await usersService.getTerms(req.user.id)
        res.json({ success: true, data: result })
    } catch (err) {
        next(err)
    }
}

// 약관 동의 저장
export async function updateTerms(req, res, next) {
    try {
        const result = await usersService.updateTerms(req.user.id, req.body?.agreed)
        res.json({ success: true, data: result })
    } catch (err) {
        next(err)
    }
}