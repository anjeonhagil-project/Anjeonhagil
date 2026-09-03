// 기능: M-AUTH-002 로그인 화면
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient.js'
import { Input, Button, SocialLoginButton } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import styles from './LoginPage.module.css'

const OAUTH_PROVIDER_MAP = {
    naver: 'custom:naver',
    kakao: 'kakao',
    google: 'google',
}

function LoginPage() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return

        setSubmitting(true)
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        setSubmitting(false)

        if (signInError) {
            setError('이메일 또는 비밀번호가 올바르지 않습니다')
            return
        }
        // 로그인 성공 시 AuthRedirect가 onboarding 여부에 따라 /home 또는 /onboarding으로 자동 이동
    }

    const handleSocialLogin = (provider) => {
        supabase.auth.signInWithOAuth({ provider: OAUTH_PROVIDER_MAP[provider] })
    }

    return (
        <div>
            <Header title="로그인" onBack={() => window.history.back()} />
            <form className={styles.page} onSubmit={handleSubmit}>
                <Input
                    label="이메일"
                    type="email"
                    placeholder="이메일을 입력해주세요"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value)
                        setError('')
                    }}
                    error={error}
                    hideErrorText
                />
                <Input
                    label="비밀번호"
                    type="password"
                    placeholder="비밀번호를 입력해주세요"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value)
                        setError('')
                    }}
                    error={error}
                />
                <Button type="submit" fullWidth className={styles.loginBtn}>
                    {submitting ? '로그인 중...' : '로그인'}
                </Button>
                <div className={styles.linkRow}>
                    <button type="button" className={styles.link} onClick={() => navigate('/signup')}>
                        회원가입
                    </button>
                    <span className={styles.linkDivider} />
                    <button type="button" className={styles.link} onClick={() => navigate('/forgot-password')}>
                        비밀번호 찾기
                    </button>
                </div>
                <div className={styles.divider}>또는 소셜 로그인</div>
                <div className={styles.socialRow}>
                    <SocialLoginButton provider="naver" onClick={() => handleSocialLogin('naver')} />
                    <SocialLoginButton provider="kakao" onClick={() => handleSocialLogin('kakao')} />
                    <SocialLoginButton provider="google" onClick={() => handleSocialLogin('google')} />
                </div>
            </form>
        </div>
    )
}

export default LoginPage
