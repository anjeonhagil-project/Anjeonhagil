// # 기능: INQ-001~003: 사용자 문의 등록/목록/상세 비즈니스 규칙
import {
    createInquiry as insertInquiry,
    findInquiryByIdAndUserId,
    findInquiriesByUserId,
} from './inquiries.repository.js'

const STATUS_LABELS = {
    received: '접수',
    in_review: '처리중',
    answered: '답변완료',
}

function toInquiryResponse(inquiry) {
    if (!inquiry) return null

    return {
        inquiryId: inquiry.id,
        category: inquiry.category,
        title: inquiry.title,
        content: inquiry.content,
        status: inquiry.status,
        statusLabel: STATUS_LABELS[inquiry.status] ?? inquiry.status,
        answerContent: inquiry.answer_content,
        createdAt: inquiry.created_at,
        answeredAt: inquiry.answered_at,
        updatedAt: inquiry.updated_at,
    }
}

// 마이페이지에는 서비스 문의 한 종류만 등록한다.
export async function createInquiry(userId, { title, content }) {
    const inquiry = await insertInquiry({
        userId,
        category: 'service',
        title: title.trim(),
        content: content.trim(),
    })

    return toInquiryResponse(inquiry)
}

export async function listMyInquiries(userId, { page = 1, limit = 20 } = {}) {
    const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1)
    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100)
    const { inquiries, total } = await findInquiriesByUserId({
        userId,
        page: parsedPage,
        limit: parsedLimit,
    })

    return {
        items: inquiries.map(toInquiryResponse),
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
    }
}

export async function getMyInquiry(userId, inquiryId) {
    const inquiry = await findInquiryByIdAndUserId(inquiryId, userId)
    return toInquiryResponse(inquiry)
}
