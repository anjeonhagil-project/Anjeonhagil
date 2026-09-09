// # 기능: ADM-USER: 회원 목록/상세 DB query 전담

import { supabase } from '../../../lib/supabase.js'

// 회원 목록 조회
export async function findUsers({
    search,
    isActive,
    signupProvider,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
}) {
    const from = (page - 1) * limit
    const to = from + limit - 1

    const sortColumnMap = {
        createdAt: 'created_at',
        username: 'username',
        email: 'email',
        isActive: 'is_active',
        signupProvider: 'signup_provider',
    }

    const sortColumn =
        sortColumnMap[sortBy] ?? 'created_at'

    const ascending = sortOrder === 'asc'


    let query = supabase
        .from('users')
        .select(
            `
            id,
            username,
            email,
            nickname,
            signup_provider,
            is_active,
            onboarding,
            withdrawn_at,
            created_at,
            updated_at
            `,
            { count: 'exact' }
        )
        .order(sortColumn, { ascending })

    // 이메일 / 아이디 / 닉네임 검색
    if (search) {
        query = query.or(
            `email.ilike.%${search}%,username.ilike.%${search}%,nickname.ilike.%${search}%`
        )
    }

    // 활성 / 탈퇴 상태 필터
    if (typeof isActive === 'boolean') {
        query = query.eq('is_active', isActive)
    }

    // 가입 유형 필터
    if (signupProvider) {
        query = query.eq('signup_provider', signupProvider)
    }

    const { data, error, count } = await query.range(from, to)

    if (error) throw error

    return {
        users: data ?? [],
        total: count ?? 0,
    }
}

// 회원 상세 조회
export async function findUserById(userId) {
    const { data, error } = await supabase
        .from('users')
        .select(`
            id,
            username,
            email,
            nickname,
            signup_provider,
            is_active,
            onboarding,
            withdrawn_at,
            created_at,
            updated_at
        `)
        .eq('id', userId)
        .maybeSingle()

    if (error) throw error

    return data
}

// 여러 회원의 관리자 권한 정보 조회
export async function findAdminsByUserIds(userIds) {
    if (!userIds?.length) {
        return []
    }

    const { data, error } = await supabase
        .from('admins')
        .select(`
            id,
            email,
            role,
            is_active,
            granted_by_admin_id,
            granted_at,
            revoked_at,
            last_login_at
        `)
        .in('id', userIds)

    if (error) throw error

    return data ?? []
}

// 특정 회원의 관리자 권한 정보 조회
export async function findAdminByUserId(userId) {
    const { data, error } = await supabase
        .from('admins')
        .select(`
            id,
            email,
            role,
            is_active,
            granted_by_admin_id,
            granted_at,
            revoked_at,
            last_login_at
        `)
        .eq('id', userId)
        .maybeSingle()

    if (error) throw error

    return data
}