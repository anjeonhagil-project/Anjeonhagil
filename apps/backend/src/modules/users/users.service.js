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

// 회원탈퇴: 즉시 계정을 비활성화하고 30일 뒤 영구 삭제 대상으로 표시
export async function withdrawMe(userId) {
    const withdrawnUser = await usersRepository.withdrawUser(userId)

    if (!withdrawnUser) {
        const error = new Error(
            '이미 탈퇴했거나 존재하지 않는 계정입니다.'
        )
        error.status = 409
        error.code = 'ACCOUNT_ALREADY_WITHDRAWN'
        throw error
    }

    return {
        withdrawnAt: withdrawnUser.withdrawn_at,
    }
}

// 탈퇴 계정의 복구 가능 여부 조회
export async function getAccountStatus(userId) {
    const account = await usersRepository.findAccountStatus(userId)

    if (!account) {
        const error = new Error('존재하지 않는 계정입니다.')
        error.status = 404
        throw error
    }

    const withdrawnAt = account.withdrawn_at
        ? new Date(account.withdrawn_at)
        : null

    const restoreDeadline = withdrawnAt
        ? new Date(
            withdrawnAt.getTime() +
            30 * 24 * 60 * 60 * 1000
        )
        : null

    return {
        isActive: account.is_active,
        withdrawnAt: account.withdrawn_at,
        canRestore:
            !account.is_active &&
            restoreDeadline !== null &&
            restoreDeadline > new Date(),
    }
}

// 탈퇴 후 30일 이내 계정 복구
export async function restoreMe(userId) {
    const accountStatus = await getAccountStatus(userId)

    if (!accountStatus.canRestore) {
        const error = new Error(
            '복구 가능 기간이 지났거나 복구할 수 없는 계정입니다.'
        )
        error.status = 409
        error.code = 'ACCOUNT_RESTORE_UNAVAILABLE'
        throw error
    }

    const restoredUser = await usersRepository.restoreUser(userId)

    if (!restoredUser) {
        const error = new Error(
            '계정 복구 처리에 실패했습니다. 다시 시도해주세요.'
        )
        error.status = 409
        error.code = 'ACCOUNT_RESTORE_FAILED'
        throw error
    }

    return {
        isActive: restoredUser.is_active,
        withdrawnAt: restoredUser.withdrawn_at,
    }
}