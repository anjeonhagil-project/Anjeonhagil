// 기능: 로그인 성공 시 약관동의/위치권한/onboarding 완료 여부에 따라 자동 이동
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

// 위치 권한 화면은 브라우저 권한 상태라 계정에 귀속되지 않음 → 로컬에 "봤는지"만 기록
export const LOCATION_PERMISSION_SEEN_KEY = 'anjeonhagil:locationPermissionSeen'

// 약관동의(M-AUTH-007) → 위치권한(M-AUTH-008) → 온보딩 설문 → 홈 순서로 리다이렉트
function AuthRedirect() {
    const { isAuthenticated, profile, termsAgreed, loading } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (!isAuthenticated || loading || !profile || termsAgreed === null) return

        const path = location.pathname
        // 이미 목적지 화면(및 약관 하위 상세 화면)에 있으면 건드리지 않음
        if (path.startsWith('/terms')) return
        if (path === '/location-permission' || path === '/onboarding' || path === '/home' || path.startsWith('/favorites')) return

        const locationSeen = localStorage.getItem(LOCATION_PERMISSION_SEEN_KEY) === 'true'

        if (!termsAgreed) {
            navigate('/terms', { replace: true })
        } else if (!locationSeen) {
            navigate('/location-permission', { replace: true })
        } else {
            navigate(profile.onboarding ? '/home' : '/onboarding', { replace: true })
        }
    }, [isAuthenticated, loading, profile, termsAgreed, location.pathname, navigate])

    return null
}

export default AuthRedirect
