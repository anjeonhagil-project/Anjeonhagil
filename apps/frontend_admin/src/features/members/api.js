// # 기능: A-MEMBER: 회원 목록/상세 조회 API 함수 모음

import { apiClient } from '../../lib/apiClient.js'


// 회원 목록 조회
// GET /api/admin/users
export async function getMembers({
    search,
    isActive,
    signupProvider,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
} = {}) {
    const params = new URLSearchParams()

    if (search) {
        params.set('search', search)
    }

    if (isActive !== undefined) {
        params.set('isActive', String(isActive))
    }

    if (signupProvider) {
        params.set('signupProvider', signupProvider)
    }

    params.set('page', String(page))
    params.set('limit', String(limit))
    params.set('sortBy', sortBy)
    params.set('sortOrder', sortOrder)

    return await apiClient(
        `/admin/users?${params.toString()}`
    )
}


// 회원 상세 조회
// GET /api/admin/users/:userId
export async function getMemberById(userId) {
    return await apiClient(
        `/admin/users/${userId}`
    )
}