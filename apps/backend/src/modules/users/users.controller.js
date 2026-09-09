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

// 마이페이지 - 프로필 관리
export async function updateMe(req, res, next) {
    try {
        const user = await usersService.updateMe(
            req.user.id,
            req.body.nickname
        )

        res.json({
            success: true,
            data: {
                userId: user.id,
                nickname: user.nickname,
            },
        })
    } catch (err) {
        next(err)
    }
}

// 회원탈퇴: 계정을 즉시 비활성화하고 30일 뒤 삭제 대상으로 표시
export async function withdrawMe(req, res, next) {
    try {
        const result = await usersService.withdrawMe(req.user.id)

        res.json({
            success: true,
            data: result,
        })
    } catch (error) {
        next(error)
    }
}

// 탈퇴 계정의 복구 가능 상태 조회
export async function getAccountStatus(req, res, next) {
    try {
        const result = await usersService.getAccountStatus(req.user.id)

        res.json({
            success: true,
            data: result,
        })
    } catch (error) {
        next(error)
    }
}

// 탈퇴 후 30일 이내 계정 복구
export async function restoreMe(req, res, next) {
    try {
        const result = await usersService.restoreMe(req.user.id)

        res.json({
            success: true,
            data: result,
        })
    } catch (error) {
        next(error)
    }
}
