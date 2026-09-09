// # 기능: Super Admin 관리자 목록/생성/역할·상태 변경 DB query 담당

import { supabase } from '../../../lib/supabase.js'


const ADMIN_SELECT = `
    id,
    email,
    role,
    is_active,
    granted_by_admin_id,
    granted_at,
    revoked_at,
    last_login_at,
    created_at
`


// 관리자 전체 목록 조회
export async function findAllAdmins() {
    const { data, error } = await supabase
        .from('admins')
        .select(ADMIN_SELECT)
        .order('created_at', { ascending: false })

    if (error) {
        throw error
    }

    return data
}


// 관리자 단건 조회
export async function findAdminById(adminId) {
    const { data, error } = await supabase
        .from('admins')
        .select(ADMIN_SELECT)
        .eq('id', adminId)
        .maybeSingle()

    if (error) {
        throw error
    }

    return data
}


// 관리자 권한을 부여할 일반 회원 조회
export async function findUserForAdminGrant(userId) {
    const { data, error } = await supabase
        .from('users')
        .select(`
            id,
            email,
            is_active
        `)
        .eq('id', userId)
        .maybeSingle()

    if (error) {
        throw error
    }

    return data
}


// 관리자 권한 최초 부여
export async function createAdmin({
    adminId,
    email,
    role,
    grantedByAdminId,
}) {
    const now = new Date().toISOString()

    const { data, error } = await supabase
        .from('admins')
        .insert({
            id: adminId,
            email,
            role,
            is_active: true,
            granted_by_admin_id: grantedByAdminId,
            granted_at: now,
            revoked_at: null,
        })
        .select(ADMIN_SELECT)
        .single()

    if (error) {
        throw error
    }

    return data
}


// 관리자 역할 / 활성 상태 변경
export async function updateAdmin(
    adminId,
    {
        email,
        role,
        isActive,
        grantedByAdminId,
    }
) {
    const updates = {}

    if (email !== undefined) {
        updates.email = email
    }

    if (role !== undefined) {
        updates.role = role
    }

    if (isActive !== undefined) {
        updates.is_active = isActive

        if (isActive) {
            updates.revoked_at = null
            updates.granted_at = new Date().toISOString()

            if (grantedByAdminId) {
                updates.granted_by_admin_id = grantedByAdminId
            }
        } else {
            updates.revoked_at = new Date().toISOString()
        }
    }

    const { data, error } = await supabase
        .from('admins')
        .update(updates)
        .eq('id', adminId)
        .select(ADMIN_SELECT)
        .single()

    if (error) {
        throw error
    }

    return data
}


// 관리자 권한 회수
// 실제 row 삭제가 아니라 비활성화 처리
export async function revokeAdmin(adminId) {
    const { data, error } = await supabase
        .from('admins')
        .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
        })
        .eq('id', adminId)
        .select(ADMIN_SELECT)
        .single()

    if (error) {
        throw error
    }

    return data
}


// 현재 활성 SUPER_ADMIN 수 조회
export async function countActiveSuperAdmins() {
    const { count, error } = await supabase
        .from('admins')
        .select('id', {
            count: 'exact',
            head: true,
        })
        .eq('role', 'super_admin')
        .eq('is_active', true)

    if (error) {
        throw error
    }

    return count ?? 0
}