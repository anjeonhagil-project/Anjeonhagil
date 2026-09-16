// # 기능: 마이페이지 고객지원(공지/문의) API 함수 모음
import { apiClient } from '../../lib/apiClient.js'

export function getNotices({ page = 1, limit = 20 } = {}) {
    return apiClient.get(`/notices?page=${page}&limit=${limit}`)
}

export function getNotice(noticeId) {
    return apiClient.get(`/notices/${noticeId}`)
}

export function getMyInquiries({ page = 1, limit = 20 } = {}) {
    return apiClient.get(`/inquiries/me?page=${page}&limit=${limit}`)
}

export function getMyInquiry(inquiryId) {
    return apiClient.get(`/inquiries/${inquiryId}`)
}

export function createInquiry({ title, content }) {
    return apiClient.post('/inquiries', { title, content })
}
