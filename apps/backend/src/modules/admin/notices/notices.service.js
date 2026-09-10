// # 기능: 관리자 공지 CRUD 비즈니스 규칙/transaction
// 목록 페이지네이션 , 작성 관리자 정보 매핑, 공지 등록 수정 삭제 처리

import {
    findNotices,
    findNoticeById,
    findAdminById,
    findAdminsByIds,
    createNotice,
    updateNotice,
    deleteNotice,
} from './notices.repository.js'


// 공지사항 응답 형태 변환
function mapNotice(notice, admin = null) {
    if (!notice) {
        return null
    }

    return {
        noticeId: notice.id,
        title: notice.title,
        content: notice.content,
        isPublished: notice.is_published,
        publishedAt: notice.published_at,

        author: admin
            ? {
                  adminId: admin.id,
                  email: admin.email,
                  role: admin.role,
              }
            : null,

        createdAt: notice.created_at,
        updatedAt: notice.updated_at,
    }
}


// 목록 조회
export async function listNotices({
    page = 1,
    limit = 10,
    search = '',
    isPublished,
    sortBy = 'createdAt',
    sortOrder = 'desc',
}) {
    // query string으로 들어오기 때문에 숫자로 변환
    const parsedPage = Math.max(
        Number.parseInt(page, 10) || 1,
        1
    )

    const parsedLimit = Math.max(
        Number.parseInt(limit, 10) || 10,
        1
    )

    // true / false 문자열 → boolean 변환
    let parsedIsPublished

    if (isPublished === true || isPublished === 'true') {
        parsedIsPublished = true
    } else if (
        isPublished === false ||
        isPublished === 'false'
    ) {
        parsedIsPublished = false
    }

    const { notices, total } = await findNotices({
        page: parsedPage,
        limit: parsedLimit,
        search: search.trim(),
        isPublished: parsedIsPublished,
        sortBy,
        sortOrder,
    })

    // 목록에 존재하는 작성 관리자 ID 수집
    const adminIds = notices
        .map((notice) => notice.created_by)
        .filter(Boolean)

    const admins = await findAdminsByIds(adminIds)

    // adminId → admin 객체 매핑
    const adminMap = new Map(
        admins.map((admin) => [
            admin.id,
            admin,
        ])
    )

    const items = notices.map((notice) =>
        mapNotice(
            notice,
            adminMap.get(notice.created_by) ?? null
        )
    )

    return {
        items,
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
    }
}


// 상세 조회
export async function getNotice(noticeId) {
    const notice = await findNoticeById(noticeId)

    if (!notice) {
        return null
    }

    const admin = await findAdminById(
        notice.created_by
    )

    return mapNotice(notice, admin)
}


// 공지사항 등록
export async function addNotice({
    title,
    content,
    isPublished = false,
    createdBy,
}) {
    const notice = await createNotice({
        title: title.trim(),
        content: content.trim(),
        isPublished,
        createdBy,
    })

    const admin = await findAdminById(
        notice.created_by
    )

    return mapNotice(notice, admin)
}


// 공지사항 수정
export async function editNotice(
    noticeId,
    {
        title,
        content,
        isPublished,
    }
) {
    const notice = await updateNotice(
        noticeId,
        {
            title:
                title !== undefined
                    ? title.trim()
                    : undefined,

            content:
                content !== undefined
                    ? content.trim()
                    : undefined,

            isPublished,
        }
    )

    if (!notice) {
        return null
    }

    const admin = await findAdminById(
        notice.created_by
    )

    return mapNotice(notice, admin)
}


// 공지사항 삭제
export async function removeNotice(noticeId) {
    const deletedNotice =
        await deleteNotice(noticeId)

    if (!deletedNotice) {
        return null
    }

    return {
        noticeId: deletedNotice.id,
    }
}