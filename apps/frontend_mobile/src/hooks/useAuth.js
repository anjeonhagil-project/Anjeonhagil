// 기능: Supabase session + 서비스 users/me 상태를 조합하는 auth hook
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { apiClient } from '../lib/apiClient.js'

// 로그인 여부(session)와 서비스 프로필을 화면에서 바로 쓸 수 있는 형태로 합쳐서 돌려주는 hook
export function useAuth() {
    const [session, setSession] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    // 최초 진입 시 현재 세션을 가져오고, 이후 로그인/로그아웃/토큰 갱신을 실시간으로 반영
    useEffect(() => {
        let mounted = true

        supabase.auth.getSession().then(({ data }) => {
            if (mounted) setSession(data.session)
        })

        const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession)
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
            setLoading(false)
            return
        }

        setLoading(true)
        apiClient
            .get('/users/me')
            .then(setProfile)
            .catch(() => setProfile(null))
            .finally(() => setLoading(false))
    }, [session])

    return {
        session,
        user: session?.user ?? null,
        profile,
        loading,
        isAuthenticated: Boolean(session),
    }
}
