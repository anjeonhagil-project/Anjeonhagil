// # 기능: A-NOTICE 관리자 공지사항 API 함수 모음

import { apiClient } from '../../lib/apiClient.js'


// 공지사항 목록 조회
// GET /api/admin/notices
export async function getNotices({
    search,
    isPublished,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
} = {}) {
    const params = new URLSearchParams()

    if (search) {
        params.set('search', search)
    }

    if (isPublished !== undefined) {
        params.set(
            'isPublished',
            String(isPublished)
        )
    }

    params.set('page', String(page))
    params.set('limit', String(limit))
    params.set('sortBy', sortBy)
    params.set('sortOrder', sortOrder)

    return await apiClient(
        `/admin/notices?${params.toString()}`
    )
}


// 공지사항 상세 조회
// GET /api/admin/notices/:noticeId
export async function getNoticeById(noticeId) {
    return await apiClient(
        `/admin/notices/${noticeId}`
    )
}


// 공지사항 등록
// POST /api/admin/notices
export async function createNotice({
    title,
    content,
    isPublished,
}) {
    return await apiClient(
        '/admin/notices',
        {
            method: 'POST',
            body: {
                title,
                content,
                isPublished,
            },
        }
    )
}


// 공지사항 수정
// PATCH /api/admin/notices/:noticeId
export async function updateNotice(
    noticeId,
    {
        title,
        content,
        isPublished,
    }
) {
    return await apiClient(
        `/admin/notices/${noticeId}`,
        {
            method: 'PATCH',
            body: {
                title,
                content,
                isPublished,
            },
        }
    )
}


// 공지사항 삭제
// DELETE /api/admin/notices/:noticeId
export async function deleteNotice(noticeId) {
    return await apiClient(
        `/admin/notices/${noticeId}`,
        {
            method: 'DELETE',
        }
    )
}