// # 기능: A-ADMIN: 관리자 목록/권한 부여/역할 변경/권한 회수 API 함수 모음

import { apiClient } from '../../lib/apiClient.js'


// 관리자 목록 조회
// GET /api/admin/admins
export async function getAdmins() {
    return await apiClient('/admin/admins')
}


// 관리자 권한 부여
// POST /api/admin/admins
export async function grantAdmin({
    adminId,
    role = 'admin',
}) {
    return await apiClient('/admin/admins', {
        method: 'POST',
        body: {
            adminId,
            role,
        },
    })
}


// 관리자 역할 / 활성 상태 변경
// PATCH /api/admin/admins/:adminId
export async function updateAdmin(
    adminId,
    {
        role,
        isActive,
    }
) {
    const body = {}

    if (role !== undefined) {
        body.role = role
    }

    if (isActive !== undefined) {
        body.isActive = isActive
    }

    return await apiClient(
        `/admin/admins/${adminId}`,
        {
            method: 'PATCH',
            body,
        }
    )
}


// 관리자 권한 회수
// DELETE /api/admin/admins/:adminId
export async function revokeAdmin(adminId) {
    return await apiClient(
        `/admin/admins/${adminId}`,
        {
            method: 'DELETE',
        }
    )
}