import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
    loginAdmin,
    getCurrentAdmin,
    logoutAdmin,
} from './api.js'

import LoginFailureModal from './components/LoginFailureModal.jsx'

import styles from './LoginPage.module.css'


// 비밀번호 노출 (눈 뜬 아이콘)
function EyeIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle
                cx="12"
                cy="12"
                r="3"
                stroke="currentColor"
                strokeWidth="1.6"
            />
        </svg>
    )
}


// 비밀번호 미노출 (눈 감은 아이콘)
function EyeOffIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M6.6 6.7C3.9 8.3 2 11.5 2 12s4 7 11 7c1.6 0 3-.3 4.2-.9M17.3 17.3C19.4 15.9 21 13.5 21 12s-4-7-11-7c-.7 0-1.4.06-2 .18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}


export default function LoginPage() {
    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const [showPassword, setShowPassword] =
        useState(false)

    const [emailError, setEmailError] =
        useState('')

    const [passwordError, setPasswordError] =
        useState('')

    const [loginError, setLoginError] =
        useState('')

    const [isLoading, setIsLoading] =
        useState(false)


    // 입력값 검증
    function validateForm() {
        let isValid = true

        setEmailError('')
        setPasswordError('')
        setLoginError('')


        if (!email.trim()) {
            setEmailError(
                '관리자 이메일을 입력해주세요.'
            )

            isValid = false
        }


        if (!password.trim()) {
            setPasswordError(
                '비밀번호를 입력해주세요.'
            )

            isValid = false
        }


        return isValid
    }


    // 관리자 로그인
    async function handleSubmit(event) {
        event.preventDefault()

        if (!validateForm()) {
            return
        }

        try {
            setIsLoading(true)
            setLoginError('')


            // 1. Supabase Auth 로그인
            await loginAdmin(
                email.trim(),
                password
            )


            // 2. 실제 관리자 계정인지 확인
            await getCurrentAdmin()


            // 3. 관리자 인증 성공
            navigate(
                '/dashboard',
                {
                    replace: true,
                }
            )
        } catch (error) {
            console.error(
                '관리자 로그인 실패:',
                error
            )


            // 일반 회원 계정
            if (error.status === 403) {
                await logoutAdmin()

                setLoginError(
                    '관리자 권한이 없는 계정입니다.'
                )

                return
            }


            // 인증 토큰 / 세션 오류
            if (error.status === 401) {
                await logoutAdmin()

                setLoginError(
                    '관리자 인증에 실패했습니다. 다시 로그인해주세요.'
                )

                return
            }


            // 이메일 / 비밀번호 오류
            setLoginError(
                '아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.'
            )
        } finally {
            setIsLoading(false)
        }
    }


    return (
        <main className={styles.page}>
            <section className={styles.card}>
                {/* 브랜드 영역 */}
                <div className={styles.brandArea}>
                    <img
                        src="/brand/logo.png"
                        alt="안전하길"
                        className={styles.logo}
                    />

                    <h1 className={styles.title}>
                        안전하길
                        <span
                            className={
                                styles.titleAccent
                            }
                        >
                            ADMIN
                        </span>
                    </h1>

                    <p
                        className={
                            styles.description
                        }
                    >
                        관리자만 접근할 수 있는
                        안전하길 운영 시스템입니다.
                    </p>
                </div>


                {/* 로그인 Form */}
                <form
                    className={styles.form}
                    onSubmit={handleSubmit}
                    noValidate
                >
                    {/* 이메일 */}
                    <div className={styles.field}>
                        <label
                            htmlFor="admin-email"
                            className={styles.label}
                        >
                            관리자 이메일
                        </label>

                        <div
                            className={
                                styles.inputWrapper
                            }
                        >
                            <input
                                id="admin-email"
                                type="email"
                                className={[
                                    styles.input,
                                    emailError
                                        ? styles.inputError
                                        : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                value={email}
                                onChange={(event) => {
                                    setEmail(
                                        event.target.value
                                    )

                                    if (emailError) {
                                        setEmailError('')
                                    }

                                    if (loginError) {
                                        setLoginError('')
                                    }
                                }}
                                placeholder="관리자 이메일을 입력해주세요."
                                autoComplete="email"
                            />
                        </div>

                        {emailError && (
                            <p
                                className={
                                    styles.errorMessage
                                }
                            >
                                {emailError}
                            </p>
                        )}
                    </div>


                    {/* 비밀번호 */}
                    <div className={styles.field}>
                        <label
                            htmlFor="admin-password"
                            className={styles.label}
                        >
                            비밀번호
                        </label>

                        <div
                            className={
                                styles.inputWrapper
                            }
                        >
                            <input
                                id="admin-password"
                                type={
                                    showPassword
                                        ? 'text'
                                        : 'password'
                                }
                                className={[
                                    styles.input,
                                    styles.passwordInput,
                                    passwordError
                                        ? styles.inputError
                                        : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                                value={password}
                                onChange={(event) => {
                                    setPassword(
                                        event.target.value
                                    )

                                    if (
                                        passwordError
                                    ) {
                                        setPasswordError(
                                            ''
                                        )
                                    }

                                    if (loginError) {
                                        setLoginError('')
                                    }
                                }}
                                placeholder="비밀번호를 입력해주세요."
                                autoComplete="current-password"
                            />

                            <button
                                type="button"
                                className={
                                    styles.passwordToggle
                                }
                                onClick={() =>
                                    setShowPassword(
                                        (prev) =>
                                            !prev
                                    )
                                }
                                aria-label={
                                    showPassword
                                        ? '비밀번호 숨기기'
                                        : '비밀번호 보기'
                                }
                            >
                                {showPassword
                                    ? <EyeIcon />
                                    : <EyeOffIcon />}
                            </button>
                        </div>

                        {passwordError && (
                            <p
                                className={
                                    styles.errorMessage
                                }
                            >
                                {passwordError}
                            </p>
                        )}
                    </div>



                    {/* 로그인 버튼 */}
                    <button
                        type="submit"
                        className={
                            styles.loginButton
                        }
                        disabled={isLoading}
                    >
                        {isLoading
                            ? '로그인 중...'
                            : '관리자 로그인'}
                    </button>
                </form>


                {/* 안내 문구 */}
                <p
                    className={
                        styles.guideMessage
                    }
                >
                    ※ 이 시스템은 최고 관리자에게
                    권한을 부여받은 관리자만
                    이용할 수 있습니다.
                </p>
            </section>
            {loginError && (
                <LoginFailureModal
                    message={loginError}
                    onClose={() => setLoginError('')}
                />
            )}
        </main>
    )
}