// # 기능: NOTICE-001~002: 사용자 공지 목록/상세 비즈니스 규칙
import {
    findPublishedNoticeById,
    findPublishedNotices,
} from './notices.repository.js'

function toNoticeResponse(notice) {
    if (!notice) return null

    return {
        noticeId: notice.id,
        title: notice.title,
        content: notice.content,
        publishedAt: notice.published_at,
    }
}

export async function listPublishedNotices({ page = 1, limit = 20 } = {}) {
    const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1)
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100)
    const { notices, total } = await findPublishedNotices({
        page: parsedPage,
        limit: parsedLimit,
    })

    return {
        items: notices.map(toNoticeResponse),
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
    }
}

export async function getPublishedNotice(noticeId) {
    const notice = await findPublishedNoticeById(noticeId)
    return toNoticeResponse(notice)
}
