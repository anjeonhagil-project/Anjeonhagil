// 기능: Supabase session + 서비스 users/me 상태를 조합하는 auth hook
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { apiClient } from '../lib/apiClient.js'
import { loadAuthSnapshot, shouldApplyAuthSession } from './authSession.mjs'

// 로그인 여부(session)와 서비스 프로필을 화면에서 바로 쓸 수 있는 형태로 합쳐서 돌려주는 hook
export function useAuth({ includeAccountStatus = false } = {}) {
    const [session, setSession] = useState(null)
    const [profile, setProfile] = useState(null)
    const [termsAgreed, setTermsAgreed] = useState(null) // null = 아직 확인 전
    const [loading, setLoading] = useState(true)
    const [accountStatus, setAccountStatus] = useState(null)

    // 최초 진입 시 현재 세션을 가져오고, 이후 로그인/로그아웃/토큰 갱신을 실시간으로 반영
    useEffect(() => {
        let mounted = true

        supabase.auth.getSession().then(({ data }) => {
            if (mounted) {
                setSession((currentSession) => (
                    shouldApplyAuthSession(currentSession, data.session, 'INITIAL_SESSION')
                        ? data.session
                        : currentSession
                ))
            }
        })

        const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
            setSession((currentSession) => (
                shouldApplyAuthSession(currentSession, newSession, event)
                    ? newSession
                    : currentSession
            ))
        })

        return () => {
            mounted = false
            listener.subscription.unsubscribe()
        }
    }, [])

    // session이 생기면(로그인 직후 포함) GET /users/me로 서비스 프로필을 가져와
    // onboarding/isActive 값으로 화면 분기(Home vs 온보딩)에 쓸 수 있게 함
    useEffect(() => {
        if (!session) {
            setProfile(null)
            setTermsAgreed(null)
            setAccountStatus(null)
            setLoading(false)
            return
        }

        let mounted = true

        setLoading(true)
        loadAuthSnapshot({
            loadProfile: () => apiClient.get('/users/me'),
            loadTerms: () => apiClient.get('/users/me/terms'),
            ...(includeAccountStatus ? {
                loadAccountStatus: () => apiClient.get('/users/me/account-status'),
            } : {}),
        })
            .then((snapshot) => {
                if (!mounted) return

                setProfile(snapshot.profile)
                setTermsAgreed(snapshot.termsAgreed)
                setAccountStatus(snapshot.accountStatus)
            })
            .finally(() => {
                if (mounted) setLoading(false)
            })

        return () => {
            mounted = false
        }
    }, [includeAccountStatus, session])

    return {
        session,
        user: session?.user ?? null,
        profile,
        termsAgreed,
        loading,
        isAuthenticated: Boolean(session),
        accountStatus,
    }
}
