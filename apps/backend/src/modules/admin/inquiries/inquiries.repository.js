// # 기능: ADM-INQUIRY 관리자 문의사항 DB query 전담
// # 역할:
// - 문의 목록 조회
// - 문의 상세 조회
// - 문의 작성자(users) 조회
// - 답변 관리자(admins) 조회
// - 문의 상태 / 답변 수정

import { supabase } from '../../../lib/supabase.js'


const INQUIRY_SELECT = `
    id,
    user_id,
    category,
    title,
    content,
    status,
    answer_content,
    answered_by,
    created_at,
    answered_at,
    updated_at
`


// =========================================================
// 문의사항 목록 조회
// =========================================================

export async function findInquiries({
    search,
    status,
    category,
    page = 1,
    size = 10,
    sortOrder = 'desc',
}) {
    const from = (page - 1) * size
    const to = from + size - 1

    let query = supabase
        .from('inquiries')
        .select(
            INQUIRY_SELECT,
            {
                count: 'exact',
            }
        )
        .order(
            'created_at',
            {
                ascending:
                    sortOrder === 'asc',
            }
        )


    // 제목 / 내용 검색
    if (search) {
        query = query.or(
            `title.ilike.%${search}%,content.ilike.%${search}%`
        )
    }


    // 문의 처리 상태 필터
    if (status) {
        query = query.eq(
            'status',
            status
        )
    }


    // 문의 유형 필터
    if (category) {
        query = query.eq(
            'category',
            category
        )
    }


    const {
        data,
        error,
        count,
    } = await query.range(
        from,
        to
    )


    if (error) {
        throw error
    }


    return {
        inquiries: data ?? [],
        total: count ?? 0,
    }
}


// =========================================================
// 문의사항 상세 조회
// =========================================================

export async function findInquiryById(
    inquiryId
) {
    const {
        data,
        error,
    } = await supabase
        .from('inquiries')
        .select(INQUIRY_SELECT)
        .eq(
            'id',
            inquiryId
        )
        .maybeSingle()


    if (error) {
        throw error
    }


    return data
}


// =========================================================
// 문의 작성자 단건 조회
// =========================================================

export async function findUserById(
    userId
) {
    if (!userId) {
        return null
    }


    const {
        data,
        error,
    } = await supabase
        .from('users')
        .select(`
            id,
            username,
            email,
            nickname,
            is_active,
            created_at
        `)
        .eq(
            'id',
            userId
        )
        .maybeSingle()


    if (error) {
        throw error
    }


    return data
}


// =========================================================
// 문의 목록 작성자 일괄 조회
// =========================================================

export async function findUsersByIds(
    userIds
) {
    if (!userIds?.length) {
        return []
    }


    const uniqueUserIds = [
        ...new Set(userIds),
    ]


    const {
        data,
        error,
    } = await supabase
        .from('users')
        .select(`
            id,
            username,
            email,
            nickname,
            is_active
        `)
        .in(
            'id',
            uniqueUserIds
        )


    if (error) {
        throw error
    }


    return data ?? []
}


// =========================================================
// 답변 관리자 조회
// =========================================================

export async function findAdminById(
    adminId
) {
    if (!adminId) {
        return null
    }


    const {
        data,
        error,
    } = await supabase
        .from('admins')
        .select(`
            id,
            email,
            role
        `)
        .eq(
            'id',
            adminId
        )
        .maybeSingle()


    if (error) {
        throw error
    }


    return data
}


// =========================================================
// 문의 상태 변경
// =========================================================

export async function updateInquiryStatus(
    inquiryId,
    status
) {
    const {
        data,
        error,
    } = await supabase
        .from('inquiries')
        .update({
            status,
        })
        .eq(
            'id',
            inquiryId
        )
        .select(INQUIRY_SELECT)
        .maybeSingle()


    if (error) {
        throw error
    }


    return data
}


// =========================================================
// 관리자 답변 등록
// =========================================================

export async function answerInquiry(
    inquiryId,
    {
        answerContent,
        answeredBy,
    }
) {
    const {
        data,
        error,
    } = await supabase
        .from('inquiries')
        .update({
            answer_content:
                answerContent,

            answered_by:
                answeredBy,

            status:
                'answered',
        })
        .eq(
            'id',
            inquiryId
        )
        .select(INQUIRY_SELECT)
        .maybeSingle()


    if (error) {
        throw error
    }


    return data
}