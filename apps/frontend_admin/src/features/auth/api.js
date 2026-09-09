// # 기능: 관리자 로그인/로그아웃, 세션 및 현재 관리자 조회

import { supabase } from '../../lib/supabaseClient.js'
import { apiClient } from '../../lib/apiClient.js'


// 관리자 로그인
export async function loginAdmin(email, password) {
    const { data, error } =
        await supabase.auth.signInWithPassword({
            email,
            password,
        })

    if (error) {
        throw error
    }

    return data
}


// 현재 로그인 세션 조회
export async function getSession() {
    const { data, error } =
        await supabase.auth.getSession()

    if (error) {
        throw error
    }

    return data.session
}


// 현재 로그인 관리자 조회
// GET /api/admin/me
export async function getCurrentAdmin() {
    return await apiClient('/admin/me')
}


// 관리자 로그아웃
export async function logoutAdmin() {
    const { error } = await supabase.auth.signOut()

    if (error) {
        throw error
    }
}