// 기능: 로그인 성공 시 약관동의/위치권한/onboarding 완료 여부에 따라 자동 이동
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

// 위치 권한 화면은 브라우저 권한 상태라 계정에 귀속되지 않음 → 로컬에 "봤는지"만 기록
export const LOCATION_PERMISSION_SEEN_KEY = 'anjeonhagil:locationPermissionSeen'

// 약관동의(M-AUTH-007) → 위치권한(M-AUTH-008) → 온보딩 설문 → 홈 순서로 리다이렉트
function AuthRedirect() {
    const { isAuthenticated, profile, termsAgreed, loading, user } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (!isAuthenticated || loading || !profile || termsAgreed === null) return

        const path = location.pathname
        
        // 마이페이지 - 프로필 관리: 소셜 로그인일 경우 재인증
        const requestedAt = Number(
            window.sessionStorage.getItem(
                'profile_reauth_requested_at'
            )
        )

        const lastSignInAt = new Date(
            user?.last_sign_in_at || ''
        ).getTime()

        const isRecentReauthRequest =
            Number.isFinite(requestedAt) &&
            requestedAt > 0 &&
            Date.now() - requestedAt < 10 * 60 * 1000

        const isSocialReauthReturn =
            (path === '/' || path === '/home') &&
            isRecentReauthRequest

        if (isSocialReauthReturn) {
            navigate('/my/profile?reauth=1', { replace: true })
            return
        }

        // 원래 있던 코드
        // const isSocialReauthReturn =
        //     (path === '/' || path === '/home') &&
        //     Number.isFinite(requestedAt) &&
        //     requestedAt > 0 &&
        //     Number.isFinite(lastSignInAt) &&
        //     lastSignInAt >= requestedAt

        if (isSocialReauthReturn) {
            navigate('/my/profile?reauth=1', { replace: true })
            return
        }
        // 이미 목적지 화면(및 약관 하위 상세 화면)에 있으면 건드리지 않음
        if (path.startsWith('/terms')) return
        if (path === '/email-verify') return
        const homeTabs = ['/location-permission', '/onboarding', '/home', '/search', '/favorites', '/my']
        if (homeTabs.includes(path) || path.startsWith('/favorites/') || path.startsWith('/my/')) return

        const locationSeen = localStorage.getItem(LOCATION_PERMISSION_SEEN_KEY) === 'true'

        if (!termsAgreed) {
            navigate('/terms', { replace: true })
        } else if (!locationSeen) {
            navigate('/location-permission', { replace: true })
        } else {
            navigate(profile.onboarding ? '/home' : '/onboarding', { replace: true })
        }
    }, [isAuthenticated, loading, profile, termsAgreed, location.pathname, navigate, user])

    

    return null
}

export default AuthRedirect
