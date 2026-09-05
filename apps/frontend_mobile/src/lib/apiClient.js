// 기능: Express `/api` 공통 HTTP client
// 책임: Authorization Bearer token, JSON envelope, 공통 error 처리
import { supabase } from './supabaseClient.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

// 현재 세션의 access token을 Authorization 헤더에 실어 /api를 호출하고,
// {success,data}/{success:false,error} envelope를 풀어서 data만 반환(실패 시 error throw)
async function request(path, options = {}) {
    // 로그인된 세션 있는지 supabase에 물어봄
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
            ...options.headers,
        },
    })

    if (res.status === 204) return null

    const body = await res.json()

    if (!res.ok || !body.success) {
        const error = new Error(body?.error?.message || '요청 처리 중 오류가 발생했습니다')
        error.code = body?.error?.code
        error.status = res.status
        throw error
    }

    return body.data
}

export const apiClient = {
    // 조회용 GET 요청 (예: GET /users/me)
    get: (path) => request(path),
    // 생성용 POST 요청, body를 JSON으로 직렬화해서 전송
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
    // 전체 교체/Upsert용 PUT 요청
    put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
    // 부분 수정용 PATCH 요청 (예: 닉네임 수정)
    patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
    // 삭제용 DELETE 요청, body가 필요한 경우(예: 탈퇴 confirm)만 실어 보냄
    delete: (path, body) => request(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
}
