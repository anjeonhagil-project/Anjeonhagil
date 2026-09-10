// # 기능: 관리자 Express `/api/admin/*` 공통 HTTP client
// # 책임: Authorization Bearer token, 공통 error envelope 처리

import { supabase } from './supabaseClient.js'

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'


export async function apiClient(
    path,
    {
        method = 'GET',
        body,
        headers = {},
    } = {}
) {
    const {
        data: { session },
        error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
        throw sessionError
    }

    const accessToken = session?.access_token

    if (!accessToken) {
        const error = new Error('로그인이 필요합니다.')
        error.status = 401
        throw error
    }

    const response = await fetch(
        `${API_BASE_URL}${path}`,
        {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...headers,
            },
            body:
                body !== undefined
                    ? JSON.stringify(body)
                    : undefined,
        }
    )

    let result = null

    try {
        result = await response.json()
    } catch {
        result = null
    }

    if (!response.ok) {
        const error = new Error(
            result?.error?.message ||
            'API 요청에 실패했습니다.'
        )

        error.status = response.status
        error.code = result?.error?.code
        error.details = result?.error?.details

        throw error
    }

    return result
}