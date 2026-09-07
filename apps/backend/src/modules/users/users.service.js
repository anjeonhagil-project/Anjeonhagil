// 기능: USER-001~004: 가입 완료/내정보/프로필수정/탈퇴 비즈니스 규칙/transaction
import * as usersRepository from './users.repository.js'

// 내 정보 조회
export async function getMe(userId) {
    const user = await usersRepository.findById(userId)

    if (!user.is_active) {
        const err = new Error('비활성화된 계정입니다')
        err.status = 401
        throw err
    }

    return user
}

const REQUIRED_TERMS = ['service', 'privacy', 'location']

// 약관 동의 상태 조회
export async function getTerms(userId) {
    const agreement = await usersRepository.findTermsAgreement(userId)
    return {
        required: REQUIRED_TERMS,
        agreed: Boolean(agreement),
        agreedAt: agreement?.agreed_at ?? null,
    }
}

// 약관 동의 저장
export async function updateTerms(userId, agreed) {
    if (!agreed) {
        const err = new Error('필수 약관에 동의해야 합니다')
        err.status = 400
        err.code = 'TERMS_REQUIRED'
        throw err
    }

    const agreement = await usersRepository.upsertTermsAgreement(userId)
    return { agreed: true, agreedAt: agreement.agreed_at }
}

// 마이페이지: 프로필 관리 - 닉네임
export async function updateMe(userId, nickname) {
    const normalizedNickname = nickname?.trim()

    if (!normalizedNickname) {
        const err = new Error('닉네임을 입력해주세요.')
        err.status = 400
        throw err
    }

    if (!/^[가-힣a-zA-Z0-9]{2,10}$/.test(normalizedNickname)) {
        const err = new Error('닉네임은 한글, 영문, 숫자 2~10자로 입력해주세요.')
        err.status = 400
        throw err
    }

    return usersRepository.updateNickname(userId, normalizedNickname)
}