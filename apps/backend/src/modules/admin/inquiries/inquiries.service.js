// # 기능: ADM-INQUIRY 관리자 문의사항 비즈니스 로직
// # 역할:
// - 문의 목록 pagination 처리
// - DB snake_case → API camelCase 변환
// - 문의 작성 회원 정보 연결
// - 답변 관리자 정보 연결
// - 문의 상태 변경
// - 관리자 답변 등록
// - 답변 완료 문의 재답변 방지

import {
    findInquiries,
    findInquiryById,
    findUserById,
    findUsersByIds,
    findAdminById,
    updateInquiryStatus,
    answerInquiry,
} from './inquiries.repository.js'


// =========================================================
// 문의 상태
// =========================================================

const INQUIRY_STATUS = {
    received: '접수',
    in_review: '처리중',
    answered: '답변완료',
}

const ALLOWED_STATUS = Object.keys(
    INQUIRY_STATUS
)


// =========================================================
// Error 생성
// =========================================================

function createServiceError(
    message,
    status,
    code
) {
    const error = new Error(message)

    error.status = status
    error.code = code

    return error
}


// =========================================================
// 회원 응답 형태 변환
// =========================================================

function mapUser(user) {
    if (!user) {
        return null
    }

    return {
        userId: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        isActive: user.is_active,
    }
}


// =========================================================
// 관리자 응답 형태 변환
// =========================================================

function mapAdmin(admin) {
    if (!admin) {
        return null
    }

    return {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
    }
}


// =========================================================
// 문의 응답 형태 변환
// =========================================================

function mapInquiry(
    inquiry,
    user = null,
    admin = null
) {
    if (!inquiry) {
        return null
    }

    return {
        inquiryId: inquiry.id,

        category: inquiry.category,

        title: inquiry.title,
        content: inquiry.content,

        status: inquiry.status,

        statusLabel:
            INQUIRY_STATUS[inquiry.status] ??
            inquiry.status,

        user: mapUser(user),

        answerContent:
            inquiry.answer_content,

        answeredBy:
            mapAdmin(admin),

        createdAt:
            inquiry.created_at,

        answeredAt:
            inquiry.answered_at,

        updatedAt:
            inquiry.updated_at,
    }
}


// =========================================================
// 문의 목록 조회
// =========================================================

export async function listInquiries({
    search = '',
    status,
    category,
    page = 1,
    size = 10,
    sortOrder = 'desc',
}) {
    const parsedPage = Math.max(
        Number.parseInt(page, 10) || 1,
        1
    )

    const parsedSize = Math.min(
        Math.max(
            Number.parseInt(size, 10) || 10,
            1
        ),
        100
    )


    // status가 들어온 경우 유효성 검사
    if (
        status &&
        !ALLOWED_STATUS.includes(status)
    ) {
        throw createServiceError(
            '올바르지 않은 문의 상태입니다.',
            400,
            'INVALID_INQUIRY_STATUS'
        )
    }


    const {
        inquiries,
        total,
    } = await findInquiries({
        search: search.trim(),
        status,
        category,
        page: parsedPage,
        size: parsedSize,
        sortOrder:
            sortOrder === 'asc'
                ? 'asc'
                : 'desc',
    })


    // 목록에 포함된 회원 ID
    const userIds = inquiries
        .map(
            (inquiry) =>
                inquiry.user_id
        )
        .filter(Boolean)


    // 회원정보 한 번에 조회
    const users =
        await findUsersByIds(
            userIds
        )


    // userId → user 객체
    const userMap = new Map(
        users.map(
            (user) => [
                user.id,
                user,
            ]
        )
    )


    const items = inquiries.map(
        (inquiry) =>
            mapInquiry(
                inquiry,

                userMap.get(
                    inquiry.user_id
                ) ?? null
            )
    )


    return {
        items,

        total,

        page: parsedPage,

        size: parsedSize,

        totalPages:
            Math.ceil(
                total / parsedSize
            ),
    }
}


// =========================================================
// 문의 상세 조회
// =========================================================

export async function getInquiry(
    inquiryId
) {
    const inquiry =
        await findInquiryById(
            inquiryId
        )


    if (!inquiry) {
        return null
    }


    // 문의 작성 회원
    const user =
        await findUserById(
            inquiry.user_id
        )


    // 답변한 관리자
    let admin = null

    if (inquiry.answered_by) {
        admin =
            await findAdminById(
                inquiry.answered_by
            )
    }


    return mapInquiry(
        inquiry,
        user,
        admin
    )
}


// =========================================================
// 문의 상태 변경
// =========================================================

export async function changeInquiryStatus(
    inquiryId,
    status
) {
    if (
        !ALLOWED_STATUS.includes(status)
    ) {
        throw createServiceError(
            '올바르지 않은 문의 상태입니다.',
            400,
            'INVALID_INQUIRY_STATUS'
        )
    }


    const currentInquiry =
        await findInquiryById(
            inquiryId
        )


    if (!currentInquiry) {
        return null
    }


    /*
     * answered는 답변 등록 API에서만 처리.
     * 상태만 answered로 바꾸면
     * DB CHECK 제약조건에 걸릴 수 있음.
     */
    if (status === 'answered') {
        throw createServiceError(
            '답변완료 상태는 관리자 답변 등록 시 자동으로 변경됩니다.',
            400,
            'ANSWER_REQUIRED'
        )
    }


    // 이미 답변 완료된 문의는 이전 상태로 변경하지 않음
    if (
        currentInquiry.status ===
        'answered'
    ) {
        throw createServiceError(
            '이미 답변 완료된 문의사항입니다.',
            409,
            'INQUIRY_ALREADY_ANSWERED'
        )
    }


    const inquiry =
        await updateInquiryStatus(
            inquiryId,
            status
        )


    if (!inquiry) {
        return null
    }


    const user =
        await findUserById(
            inquiry.user_id
        )


    return mapInquiry(
        inquiry,
        user
    )
}


// =========================================================
// 관리자 답변 등록
// =========================================================

export async function submitInquiryAnswer(
    inquiryId,
    {
        answerContent,
        answeredBy,
    }
) {
    const currentInquiry =
        await findInquiryById(
            inquiryId
        )


    if (!currentInquiry) {
        return null
    }


    // 답변완료 문의는 다시 수정하지 못하도록 차단
    if (
        currentInquiry.status ===
        'answered'
    ) {
        throw createServiceError(
            '이미 답변 완료된 문의사항입니다.',
            409,
            'INQUIRY_ALREADY_ANSWERED'
        )
    }


    const trimmedAnswer =
        answerContent?.trim()


    if (!trimmedAnswer) {
        throw createServiceError(
            '문의 답변 내용을 입력해주세요.',
            400,
            'ANSWER_CONTENT_REQUIRED'
        )
    }


    const inquiry =
        await answerInquiry(
            inquiryId,
            {
                answerContent:
                    trimmedAnswer,

                answeredBy,
            }
        )


    if (!inquiry) {
        return null
    }


    const [
        user,
        admin,
    ] = await Promise.all([
        findUserById(
            inquiry.user_id
        ),

        findAdminById(
            inquiry.answered_by
        ),
    ])


    return mapInquiry(
        inquiry,
        user,
        admin
    )
}