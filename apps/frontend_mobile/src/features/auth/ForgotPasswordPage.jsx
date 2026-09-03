// 기능: M-AUTH-006 비밀번호 재설정 - 이메일로 재설정 링크 요청
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { Input, Button, Modal } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import { checkEmail } from './api.js'
import styles from './ForgotPasswordPage.module.css'

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [sent, setSent] = useState(false)
    const [notFoundOpen, setNotFoundOpen] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return

        if (!EMAIL_REGEX.test(email)) {
            setError('올바른 이메일 형식이 아닙니다')
            return
        }

        setError('')
        setSubmitting(true)

        try {
            const { available } = await checkEmail(email)
            if (available) {
                // available: true = users 테이블에 없는 이메일 = 가입 안 된 계정
                setSubmitting(false)
                setNotFoundOpen(true)
                return
            }
        } catch {
            setSubmitting(false)
            setError('확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요')
            return
        }

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
        setSubmitting(false)

        if (resetError) {
            setError('메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요')
            return
        }

        setSent(true)
    }

    if (sent) {
        return (
            <div>
                <Header title="비밀번호 찾기" onBack={() => window.history.back()} />
                <div className={styles.page}>
                    <h1>이메일을 확인해주세요</h1>
                    <p>{email}로 비밀번호 재설정 링크를 보냈습니다.</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <Header title="비밀번호 찾기" onBack={() => window.history.back()} />
            <form className={styles.page} onSubmit={handleSubmit}>
                <Input
                    label="이메일"
                    type="email"
                    placeholder="가입한 이메일을 입력해주세요"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value)
                        setError('')
                    }}
                    error={error}
                />
                <Button type="submit" fullWidth disabled={!email || submitting} className={styles.submitBtn}>
                    {submitting ? '전송 중...' : '재설정 링크 보내기'}
                </Button>
            </form>
            <Modal
                open={notFoundOpen}
                icon="warning"
                title="가입되지 않은 이메일"
                description="입력하신 이메일로 가입된 계정을 찾을 수 없습니다. 이메일을 다시 확인해주세요."
                confirmLabel="확인"
                onConfirm={() => setNotFoundOpen(false)}
            />
        </div>
    )
}

export default ForgotPasswordPage
