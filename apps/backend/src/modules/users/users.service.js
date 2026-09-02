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