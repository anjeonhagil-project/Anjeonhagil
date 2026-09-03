// 기능: M-AUTH-003 회원가입 화면
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { Input, Button, SocialLoginButton } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import { checkEmail } from './api.js'
import styles from './SignUpPage.module.css'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])(?!.*\s).{8,20}$/
const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,10}$/

const OAUTH_PROVIDER_MAP = {
    naver: 'custom:naver',
    kakao: 'kakao',
    google: 'google',
}

function SignUpPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [passwordConfirm, setPasswordConfirm] = useState('')
    const [nickname, setNickname] = useState('')
    const [errors, setErrors] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [done, setDone] = useState(false)
    const [emailCheck, setEmailCheck] = useState('idle')

    const isValid =
        emailCheck === 'available' &&
        password.length > 0 &&
        passwordConfirm.length > 0 &&
        nickname.length > 0

    const handleCheckEmail = async () => {
        if (emailCheck === 'checking') return

        if (!EMAIL_REGEX.test(email)) {
            setErrors((prev) => ({ ...prev, email: '이메일을 형식에 맞게 입력해주세요' }))
            return
        }

        setErrors((prev) => ({ ...prev, email: undefined }))
        setEmailCheck('checking')
        try {
            const { available } = await checkEmail(email)
            setEmailCheck(available ? 'available' : 'taken')
        } catch {
            setEmailCheck('idle')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        const nextErrors = {}
        if (!EMAIL_REGEX.test(email)) nextErrors.email = '올바른 이메일 형식이 아닙니다'
        else if (emailCheck !== 'available') nextErrors.email = '이메일 중복확인을 해주세요'
        if (!PASSWORD_REGEX.test(password)) nextErrors.password = '영문+숫자+특수문자 포함 8~20자로 입력해주세요'
        if (password !== passwordConfirm) nextErrors.passwordConfirm = '비밀번호가 일치하지 않습니다'
        if (!NICKNAME_REGEX.test(nickname)) nextErrors.nickname = '닉네임은 한글, 영어, 숫자로 구성된 2~10글자만 가능합니다.'

        setErrors(nextErrors)
        if (Object.keys(nextErrors).length > 0) return

        setSubmitting(true)
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { nickname },
            },
        })
        setSubmitting(false)

        if (error) {
            setErrors({ email: error.message })
            return
        }

        setDone(true)
    }

    const handleSocialLogin = (provider) => {
        supabase.auth.signInWithOAuth({ provider: OAUTH_PROVIDER_MAP[provider] })
    }

    if (done) {
        return (
            <div>
                <h1>이메일을 확인해주세요</h1>
                <p>{email}로 인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해주세요.</p>
            </div>
        )
    }

    return (
        <div>
            <Header title="회원가입" onBack={() => window.history.back()} />
            <form className={styles.page} onSubmit={handleSubmit}>
                <div className={styles.inputRow}>
                    <Input
                        label="이메일"
                        type="email"
                        placeholder="이메일을 입력해주세요"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value)
                            setEmailCheck('idle')
                        }}
                        error={errors.email}
                        hideErrorText
                    />
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleCheckEmail}
                    >
                        중복확인
                    </Button>
                </div>
                {errors.email && email && <p className={styles.hintError}>{errors.email}</p>}
                {!errors.email && emailCheck === 'available' && <p className={styles.hint}>사용 가능한 이메일입니다</p>}
                {!errors.email && emailCheck === 'taken' && <p className={styles.hintError}>이미 사용 중인 이메일입니다</p>}
                <Input
                    label="비밀번호"
                    type="password"
                    placeholder="비밀번호를 입력해주세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={errors.password}
                />
                <Input
                    label="비밀번호 확인"
                    type="password"
                    placeholder="비밀번호를 다시 입력해주세요"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    error={errors.passwordConfirm}
                />
                <Input
                    label="닉네임"
                    placeholder="닉네임을 입력해주세요"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    error={errors.nickname}
                />
                <Button type="submit" fullWidth disabled={!isValid || submitting} className={styles.signUpBtn}>
                    {submitting ? '가입 중...' : '가입하기'}
                </Button>
                <div className={styles.divider}>또는 소셜 회원가입</div>
                <div className={styles.socialRow}>
                    <SocialLoginButton provider="naver" onClick={() => handleSocialLogin('naver')} />
                    <SocialLoginButton provider="kakao" onClick={() => handleSocialLogin('kakao')} />
                    <SocialLoginButton provider="google" onClick={() => handleSocialLogin('google')} />
                </div>
            </form>
        </div>
    )
}

export default SignUpPage
