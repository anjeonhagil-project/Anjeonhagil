// # 기능: ADM-USER: 회원 목록/상세 비즈니스 규칙/transaction

import * as usersRepository from './users.repository.js'


// 관리자 정보와 회원 정보를 합쳐 화면용 role 생성
function resolveRole(admin) {
    if (!admin || !admin.is_active) {
        return 'user'
    }

    return admin.role
}


// 회원 목록 조회
export async function getUsers({
    search,
    isActive,
    signupProvider,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
}) {
    const result = await usersRepository.findUsers({
        search,
        isActive,
        signupProvider,
        page,
        limit,
        sortBy,
        sortOrder,
    })

    const users = result.users

    const userIds = users.map((user) => user.id)

    const admins = await usersRepository.findAdminsByUserIds(
        userIds
    )

    const adminMap = new Map(
        admins.map((admin) => [
            admin.id,
            admin,
        ])
    )

    const items = users.map((user) => {
        const admin = adminMap.get(user.id)

        return {
            userId: user.id,
            username: user.username,
            email: user.email,
            nickname: user.nickname,
            signupProvider:
                user.signup_provider,
            isActive: user.is_active,
            onboarding: user.onboarding,
            role: resolveRole(admin),
            createdAt: user.created_at,
            withdrawnAt: user.withdrawn_at,
        }
    })

    return {
        items,
        pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(
                result.total / limit
            ),
        },
    }
}


// 회원 상세 조회
export async function getUserById(userId) {
    const user =
        await usersRepository.findUserById(
            userId
        )

    if (!user) {
        const err = new Error(
            '회원을 찾을 수 없습니다'
        )
        err.status = 404
        throw err
    }

    const admin =
        await usersRepository.findAdminByUserId(
            userId
        )

    return {
        userId: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        signupProvider:
            user.signup_provider,
        isActive: user.is_active,
        onboarding: user.onboarding,
        role: resolveRole(admin),

        createdAt: user.created_at,
        updatedAt: user.updated_at,
        withdrawnAt: user.withdrawn_at,

        admin: admin
            ? {
                  role: admin.role,
                  isActive: admin.is_active,
                  grantedAt:
                      admin.granted_at,
                  revokedAt:
                      admin.revoked_at,
                  lastLoginAt:
                      admin.last_login_at,
              }
            : null,
    }
}