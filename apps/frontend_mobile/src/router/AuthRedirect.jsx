// 기능: 로그인 성공 시 onboarding 완료 여부에 따라 Home/온보딩으로 자동 이동
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

// 온보딩 설문 여부에 따라 리다이렉트(/home 또는 /onboarding)
function AuthRedirect() {
    const { isAuthenticated, profile, loading } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (!isAuthenticated || loading || !profile) return
        if (location.pathname === '/home' || location.pathname === '/onboarding') return

        navigate(profile.onboarding ? '/home' : '/onboarding', { replace: true })
    }, [isAuthenticated, loading, profile, location.pathname, navigate])

    return null
}

export default AuthRedirect
