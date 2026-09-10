// # 기능: A-INQUIRY 관리자 문의사항 API 함수 모음

import { apiClient } from '../../lib/apiClient.js'


// 문의사항 목록 조회
export async function getInquiries({
    search,
    status,
    category,
    page = 1,
    size = 10,
    sortOrder = 'desc',
} = {}) {
    const params = new URLSearchParams()

    if (search) {
        params.set('search', search)
    }

    if (status) {
        params.set('status', status)
    }

    if (category) {
        params.set('category', category)
    }

    params.set('page', String(page))
    params.set('size', String(size))
    params.set('sortOrder', sortOrder)

    return await apiClient(
        `/admin/inquiries?${params.toString()}`
    )
}


// 문의사항 상세 조회
export async function getInquiryById(
    inquiryId
) {
    return await apiClient(
        `/admin/inquiries/${inquiryId}`
    )
}


// 문의 처리 상태 변경
export async function updateInquiryStatus(
    inquiryId,
    status
) {
    return await apiClient(
        `/admin/inquiries/${inquiryId}`,
        {
            method: 'PATCH',

            body: {
                status,
            },
        }
    )
}


// 관리자 답변 등록
export async function answerInquiry(
    inquiryId,
    answerContent
) {
    return await apiClient(
        `/admin/inquiries/${inquiryId}`,
        {
            method: 'PATCH',

            body: {
                answerContent,
            },
        }
    )
}