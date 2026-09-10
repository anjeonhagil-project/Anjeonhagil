// # 기능: ADM-NOTICE: 공지사항 목록/상세/등록/수정/삭제 DB query 전담

import { supabase } from "../../../lib/supabase.js"

const NOTICE_SELECT = `
    id,
    title,
    content,
    is_published,
    published_at,
    created_by,
    created_at,
    updated_at
`

// 공지사항 목록 조회
export async function findNotices({
    search,
    isPublished,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
}) {
    const from = (page - 1) * limit
    const to = from + limit - 1

    const sortColumnMap = {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        publishedAt: 'published_at',
        title: 'title',
        isPublished: 'is_published',
    }

    const sortColumn =
        sortColumnMap[sortBy] ?? 'created_at'

    const ascending = sortOrder === 'asc'

    let query = supabase
        .from('notices')
        .select(
            NOTICE_SELECT,
            { count: 'exact' }
        )
        .order(sortColumn, {
            ascending,
            nullsFirst: false,
        })

    // 제목 검색
    if (search) {
        query = query.ilike(
            'title',
            `%${search}%`
        )
    }

    // 노출 / 미노출 필터
    if (typeof isPublished === 'boolean') {
        query = query.eq(
            'is_published',
            isPublished
        )
    }

    const {
        data,
        error,
        count,
    } = await query.range(from, to)

    if (error) {
        throw error
    }

    return {
        notices: data ?? [],
        total: count ?? 0,
    }
}


// 공지사항 상세 조회
export async function findNoticeById(noticeId) {
    const { data, error } = await supabase
        .from('notices')
        .select(NOTICE_SELECT)
        .eq('id', noticeId)
        .maybeSingle()

    if (error) {
        throw error
    }

    return data
}


// 공지 작성자 정보 조회
export async function findAdminById(adminId) {
    if (!adminId) {
        return null
    }

    const { data, error } = await supabase
        .from('admins')
        .select(`
            id,
            email,
            role
        `)
        .eq('id', adminId)
        .maybeSingle()

    if (error) {
        throw error
    }

    return data
}


// 여러 공지 작성자의 관리자 정보 조회
export async function findAdminsByIds(adminIds) {
    if (!adminIds?.length) {
        return []
    }

    const uniqueAdminIds = [
        ...new Set(adminIds),
    ]

    const { data, error } = await supabase
        .from('admins')
        .select(`
            id,
            email,
            role
        `)
        .in('id', uniqueAdminIds)

    if (error) {
        throw error
    }

    return data ?? []
}


// 공지사항 등록
export async function createNotice({
    title,
    content,
    isPublished = false,
    createdBy,
}) {
    const { data, error } = await supabase
        .from('notices')
        .insert({
            title,
            content,
            is_published: isPublished,
            created_by: createdBy,
        })
        .select(NOTICE_SELECT)
        .single()

    if (error) {
        throw error
    }

    return data
}


// 공지사항 수정
export async function updateNotice(
    noticeId,
    {
        title,
        content,
        isPublished,
    }
) {
    const updates = {}

    if (title !== undefined) {
        updates.title = title
    }

    if (content !== undefined) {
        updates.content = content
    }

    if (isPublished !== undefined) {
        updates.is_published = isPublished
    }

    const { data, error } = await supabase
        .from('notices')
        .update(updates)
        .eq('id', noticeId)
        .select(NOTICE_SELECT)
        .maybeSingle()

    if (error) {
        throw error
    }

    return data
}


// 공지사항 삭제
export async function deleteNotice(noticeId) {
    const { data, error } = await supabase
        .from('notices')
        .delete()
        .eq('id', noticeId)
        .select('id')
        .maybeSingle()

    if (error) {
        throw error
    }

    return data
}