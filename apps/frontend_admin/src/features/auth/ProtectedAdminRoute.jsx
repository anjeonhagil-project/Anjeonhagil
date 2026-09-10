import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import {
    getSession,
    getCurrentAdmin,
    logoutAdmin,
} from './api.js'


export default function ProtectedAdminRoute() {
    const [isLoading, setIsLoading] = useState(true)
    const [isAuthorized, setIsAuthorized] = useState(false)


    useEffect(() => {
        async function checkAdminAuth() {
            try {
                // 1. Supabase 로그인 세션 확인
                const session = await getSession()

                // 로그인 세션 자체가 없으면 관리자 페이지 접근 불가
                if (!session) {
                    setIsAuthorized(false)
                    return
                }

                // 2. 실제 관리자 계정인지 백엔드에서 확인
                await getCurrentAdmin()

                // 관리자 확인 성공
                setIsAuthorized(true)
            } catch (error) {
                console.error('관리자 인증 확인 실패:', error)

                // 유효하지 않은 세션이 남아 있을 수 있으므로 로그아웃
                await logoutAdmin()

                setIsAuthorized(false)
            } finally {
                setIsLoading(false)
            }
        }

        checkAdminAuth()
    }, [])


    // 인증 확인 중
    if (isLoading) {
        return <div>관리자 인증 확인 중...</div>
    }


    // 로그인하지 않았거나 관리자가 아닌 경우
    if (!isAuthorized) {
        return <Navigate to="/login" replace />
    }


    // 관리자 인증 성공 시 하위 관리자 페이지 표시
    return <Outlet />
}