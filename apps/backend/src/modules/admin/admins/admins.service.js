// # 기능: Super Admin 관리자 목록/생성/역할·상태 변경 비즈니스 규칙 담당

import {
    findAllAdmins,
    findAdminById,
    findUserForAdminGrant,
    createAdmin,
    updateAdmin,
    revokeAdmin as revokeAdminRepository,
    countActiveSuperAdmins,
} from './admins.repository.js'


// 서비스 에러 생성
function createServiceError(message, status, code) {
    const error = new Error(message)

    error.status = status
    error.code = code

    return error
}


// 관리자 목록 조회
export async function getAdmins() {
    return await findAllAdmins()
}


// 관리자 권한 부여
export async function grantAdmin({
    adminId,
    role = 'admin',
    grantedByAdminId,
}) {
    // 실제 회원인지 확인
    const user = await findUserForAdminGrant(adminId)

    if (!user) {
        throw createServiceError(
            '회원을 찾을 수 없습니다.',
            404,
            'USER_NOT_FOUND'
        )
    }

    // 비활성 회원에게 관리자 권한 부여 방지
    if (!user.is_active) {
        throw createServiceError(
            '비활성화된 회원에게 관리자 권한을 부여할 수 없습니다.',
            409,
            'USER_INACTIVE'
        )
    }

    // admins.email NOT NULL 대응
    if (!user.email) {
        throw createServiceError(
            '회원 이메일 정보가 없습니다.',
            409,
            'USER_EMAIL_NOT_FOUND'
        )
    }

    const existingAdmin = await findAdminById(adminId)

    // 이미 활성 관리자
    if (existingAdmin?.is_active) {
        throw createServiceError(
            '이미 관리자 권한이 부여된 사용자입니다.',
            409,
            'ADMIN_ALREADY_EXISTS'
        )
    }

    // 과거 관리자였지만 권한이 회수된 경우 → 기존 row 재활성화
    if (existingAdmin && !existingAdmin.is_active) {
        return await updateAdmin(adminId, {
            email: user.email,
            role,
            isActive: true,
            grantedByAdminId,
        })
    }

    // 최초 관리자 권한 부여
    return await createAdmin({
        adminId,
        email: user.email,
        role,
        grantedByAdminId,
    })
}


// 관리자 역할 / 활성 상태 변경
export async function modifyAdmin({
    adminId,
    role,
    isActive,
    grantedByAdminId,
}) {
    const admin = await findAdminById(adminId)

    if (!admin) {
        throw createServiceError(
            '관리자를 찾을 수 없습니다.',
            404,
            'ADMIN_NOT_FOUND'
        )
    }

    /*
     * 마지막 활성 SUPER_ADMIN 보호
     *
     * 현재 활성 super_admin을
     * - admin으로 변경하거나
     * - 비활성화하려는 경우
     */
    const removingActiveSuperAdmin =
        admin.role === 'super_admin' &&
        admin.is_active &&
        (
            (role !== undefined && role !== 'super_admin') ||
            isActive === false
        )

    if (removingActiveSuperAdmin) {
        const superAdminCount = await countActiveSuperAdmins()

        if (superAdminCount <= 1) {
            throw createServiceError(
                '마지막 슈퍼관리자의 권한은 변경할 수 없습니다.',
                409,
                'LAST_SUPER_ADMIN'
            )
        }
    }

    return await updateAdmin(adminId, {
        role,
        isActive,
        grantedByAdminId,
    })
}


// 관리자 권한 회수
export async function revokeAdmin(adminId) {
    const admin = await findAdminById(adminId)

    if (!admin) {
        throw createServiceError(
            '관리자를 찾을 수 없습니다.',
            404,
            'ADMIN_NOT_FOUND'
        )
    }

    if (!admin.is_active) {
        throw createServiceError(
            '이미 관리자 권한이 회수된 사용자입니다.',
            409,
            'ADMIN_ALREADY_REVOKED'
        )
    }

    // 마지막 활성 SUPER_ADMIN 보호
    if (admin.role === 'super_admin') {
        const superAdminCount = await countActiveSuperAdmins()

        if (superAdminCount <= 1) {
            throw createServiceError(
                '마지막 슈퍼관리자의 권한은 회수할 수 없습니다.',
                409,
                'LAST_SUPER_ADMIN'
            )
        }
    }

    return await revokeAdminRepository(adminId)
}