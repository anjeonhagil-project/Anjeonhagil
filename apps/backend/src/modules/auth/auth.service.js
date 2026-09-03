// # 기능: 아이디/이메일 중복확인 비즈니스 규칙
import * as authRepository from './auth.repository.js'
import { EMAIL_REGEX } from './auth.validation.js'

// 회원가입 시 이메일 중복 확인용
export async function checkEmail(value) {
    const normalized = value.trim().toLowerCase()

    if (!EMAIL_REGEX.test(normalized)) {
        const err = new Error('이메일 형식이 올바르지 않습니다')
        err.status = 400
        throw err
    }

    const exists = await authRepository.emailExists(normalized)
    return { available: !exists }
}
