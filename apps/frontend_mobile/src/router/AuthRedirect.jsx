// 기능: 로그인 성공 시 약관동의/위치권한/onboarding 완료 여부에 따라 자동 이동
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

// 위치 권한 화면은 브라우저 권한 상태라 계정에 귀속되지 않음 → 로컬에 "봤는지"만 기록
export const LOCATION_PERMISSION_SEEN_KEY = 'anjeonhagil:locationPermissionSeen'
// 설문 저장 직후, /users/me를 다시 불러오기 전에도 같은 로그인 세션에서
// 완료 상태를 유지하기 위한 사용자별 임시 표시다. 다음 로그인부터는 DB 값을 사용한다.
export const ONBOARDING_COMPLETED_USER_ID_KEY = 'anjeonhagil:onboardingCompletedUserId'

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
        // 약관 하위 화면과 이메일 인증 화면은 현재 흐름을 유지한다.
        if (path.startsWith('/terms')) return
        if (path === '/email-verify') return

        const locationSeen = localStorage.getItem(LOCATION_PERMISSION_SEEN_KEY) === 'true'
        const onboardingCompletedInSession =
            window.sessionStorage.getItem(ONBOARDING_COMPLETED_USER_ID_KEY) === user?.id
        const onboardingCompleted = profile.onboarding === true || onboardingCompletedInSession

        if (!termsAgreed) {
            navigate('/terms', { replace: true })
            return
        }

        // 완료한 회원은 로그인할 때 홈으로 이동하고, 직접 접근해도 설문/권한 화면을 다시 보지 않는다.
        if (onboardingCompleted) {
            if (path === '/' || path === '/login' || path === '/onboarding' || path === '/location-permission') {
                navigate('/home', { replace: true })
            }
            return
        }

        // 미완료 회원은 최초 흐름에서만 위치 권한 → 설문을 진행한다.
        const firstOnboardingPath = locationSeen ? '/onboarding' : '/location-permission'
        if (path !== firstOnboardingPath) {
            navigate(firstOnboardingPath, { replace: true })
        }
    }, [isAuthenticated, loading, profile, termsAgreed, location.pathname, navigate, user])

    

    return null
}

export default AuthRedirect
