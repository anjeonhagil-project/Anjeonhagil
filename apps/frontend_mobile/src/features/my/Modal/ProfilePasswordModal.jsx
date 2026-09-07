// 자체 로그인 프로필 확인 모달

import { useState } from 'react'
import { FiX } from 'react-icons/fi'
import { supabase } from '../../../lib/supabaseClient.js'
import { Button, Input } from '../../../components/common/index.js'
import styles from './ProfilePasswordModal.module.css'


function ProfilePasswordModal({ open, user, onClose, onVerified }) {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    if (!open) return null

    const handleClose = () => {
        setPassword('')
        setError('')
        onClose()
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!password || submitting) return

        if (!user?.email) {
            setError('이 계정은 비밀번호 확인을 사용할 수 없습니다.')
            return
        }

        setSubmitting(true)
        setError('')

        const { error: authError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password,
        })

        setSubmitting(false)

        if (authError) {
            setError('비밀번호가 일치하지 않습니다. 다시 확인해주세요.')
            return
        }

        setPassword('')
        onVerified()
    }

    return (
        <div
            className={styles.backdrop}
            role="presentation"
            onClick={handleClose}
        >
            <form
                className={styles.card}
                aria-modal="true"
                aria-labelledby="profile-password-title"
                role="dialog"
                onClick={(event) => event.stopPropagation()}
                onSubmit={handleSubmit}
            >
                <button
                    className={styles.closeButton}
                    type="button"
                    aria-label="닫기"
                    onClick={handleClose}
                >
                    <FiX size={20} />
                </button>

                <h2 id="profile-password-title">프로필 확인</h2>

                <p className={styles.description}>
                    개인정보 보호를 위해 비밀번호를 다시 입력해주세요.
                </p>

                <Input
                    type="password"
                    placeholder="비밀번호를 입력해주세요"
                    value={password}
                    error={error}
                    autoComplete="current-password"
                    onChange={(event) => {
                        setPassword(event.target.value)
                        setError('')
                    }}
                />

                <Button
                    type="submit"
                    fullWidth
                    disabled={!password || submitting}
                >
                    {submitting ? '확인 중...' : '확인'}
                </Button>
            </form>
        </div>
    )
}

export default ProfilePasswordModal