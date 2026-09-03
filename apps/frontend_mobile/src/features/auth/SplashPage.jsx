// 기능: M-AUTH-001 Splash - 최소 4초 노출 후, 세션 없으면 로그인 화면으로 이동
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import styles from './SplashPage.module.css'

const MIN_DISPLAY_MS = 2500

function SplashPage() {
    const { isAuthenticated, loading } = useAuth()
    const navigate = useNavigate()
    const [minTimeElapsed, setMinTimeElapsed] = useState(false)

    // 스플래시 최소 노출 시간 보장용 타이머
    useEffect(() => {
        const timer = setTimeout(() => setMinTimeElapsed(true), MIN_DISPLAY_MS)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (loading || !minTimeElapsed) return
        if (!isAuthenticated) {
            navigate('/login', { replace: true })
        }
        // 로그인된 경우는 AuthRedirect가 onboarding 여부에 따라 /home 또는 /onboarding으로 이동
    }, [isAuthenticated, loading, minTimeElapsed, navigate])

    return (
        <div className={styles.splash}>
            <img className={styles.logo} src="../public/brand/logo.png" alt="안전하길 로고" />
        </div>
    )
}

export default SplashPage
