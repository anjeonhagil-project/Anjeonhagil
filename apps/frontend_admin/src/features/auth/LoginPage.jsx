import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
    loginAdmin,
    getCurrentAdmin,
    logoutAdmin,
} from './api.js'


export default function LoginPage() {
    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)


    const handleSubmit = async (event) => {
        event.preventDefault()

        setErrorMessage('')
        setIsLoading(true)

        try {
            // 1. Supabase Auth 로그인
            await loginAdmin(email, password)

            // 2. 실제 관리자 계정인지 백엔드에서 확인
            await getCurrentAdmin()

            // 3. 관리자 확인까지 성공한 경우에만 이동
            navigate('/dashboard')
        } catch (error) {
            console.error('관리자 로그인 실패:', error)

            // Supabase 로그인은 됐지만 admins 테이블에 없는 경우
            if (error.status === 403) {
                await logoutAdmin()

                setErrorMessage(
                    '관리자 권한이 없는 계정입니다.'
                )

                return
            }

            // 토큰/세션 인증 문제
            if (error.status === 401) {
                await logoutAdmin()

                setErrorMessage(
                    '관리자 인증에 실패했습니다. 다시 로그인해주세요.'
                )

                return
            }

            // 이메일/비밀번호 오류 등
            setErrorMessage(
                '이메일 또는 비밀번호를 확인해주세요.'
            )
        } finally {
            setIsLoading(false)
        }
    }


    return (
        <main>
            <h1>관리자 로그인</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email">
                        이메일
                    </label>

                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) =>
                            setEmail(event.target.value)
                        }
                        placeholder="이메일을 입력해주세요."
                        required
                    />
                </div>

                <div>
                    <label htmlFor="password">
                        비밀번호
                    </label>

                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                        placeholder="비밀번호를 입력해주세요."
                        required
                    />
                </div>

                {errorMessage && (
                    <p>{errorMessage}</p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                >
                    {isLoading
                        ? '로그인 중...'
                        : '로그인'}
                </button>
            </form>
        </main>
    )
}