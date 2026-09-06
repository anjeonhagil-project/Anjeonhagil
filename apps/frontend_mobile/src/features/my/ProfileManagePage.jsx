import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Modal } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import { supabase } from '../../lib/supabaseClient.js'
import { useAuth } from '../../hooks/useAuth.js'
import { updateMyProfile } from './api.js'
import styles from './ProfileManagePage.module.css'

const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,10}$/

const PASSWORD_REGEX =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])(?!.*\s).{8,20}$/

function ProfileManagePage() {
    const navigate = useNavigate()
    const { profile, user } = useAuth()

    const initialNickname =
        profile?.nickname || user?.user_metadata?.nickname || ''

    const [nickname, setNickname] = useState(initialNickname)
    const [newPassword, setNewPassword] = useState('')
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
    const [errors, setErrors] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false)
    const [saveMessage, setSaveMessage] = useState('')

    const username = profile?.username || ''
    const email = profile?.email || user?.email || ''
    const isEmailLogin = user?.app_metadata?.provider === 'email'

    const validateForm = () => {
        const nextErrors = {}
        const passwordChanged = Boolean(newPassword || newPasswordConfirm)

        if (!NICKNAME_REGEX.test(nickname.trim())) {
            nextErrors.nickname =
                '닉네임은 한글, 영문, 숫자 2~10자로 입력해주세요.'
        }

        if (isEmailLogin && passwordChanged) {
            if (!PASSWORD_REGEX.test(newPassword)) {
                nextErrors.newPassword =
                    '영문, 숫자, 특수문자를 포함해 8~20자로 입력해주세요.'
            }

            if (newPassword !== newPasswordConfirm) {
                nextErrors.newPasswordConfirm =
                    '새 비밀번호가 일치하지 않습니다.'
            }
        }

        setErrors(nextErrors)
        return Object.keys(nextErrors).length === 0
    }

    const handleOpenSaveModal = (event) => {
        event.preventDefault()
        setSaveMessage('')

        if (!validateForm()) return

        setIsSaveConfirmOpen(true)
    }

    const handleConfirmSave = async () => {
        if (submitting) return

        const passwordChanged = Boolean(newPassword || newPasswordConfirm)

        setSubmitting(true)
        setSaveMessage('')

        try {
            await updateMyProfile({
                nickname: nickname.trim(),
            })

            if (isEmailLogin && passwordChanged) {
                const { error } = await supabase.auth.updateUser({
                    password: newPassword,
                })

                if (error) throw error
            }

            setNewPassword('')
            setNewPasswordConfirm('')
            setIsSaveConfirmOpen(false)
            setSaveMessage('변경사항이 저장되었습니다.')
        } catch (error) {
            setIsSaveConfirmOpen(false)
            setSaveMessage(
                error.message || '변경사항 저장에 실패했습니다. 다시 시도해주세요.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={styles.page}>
            <Header title="프로필 관리" onBack={() => navigate('/my')} />

            <form className={styles.form} onSubmit={handleOpenSaveModal}>
                <Input
                    label="아이디"
                    value={username}
                    disabled
                />

                <Input
                    label="이메일"
                    type="email"
                    value={email}
                    disabled
                />

                <Input
                    label="닉네임"
                    value={nickname}
                    placeholder="닉네임을 입력해주세요"
                    error={errors.nickname}
                    onChange={(event) => {
                        setNickname(event.target.value)
                        setErrors((current) => ({
                            ...current,
                            nickname: undefined,
                        }))
                    }}
                />

                {isEmailLogin && (
                    <>
                        <div className={styles.passwordField}>
                            <Input
                                label="새 비밀번호"
                                type="password"
                                value={newPassword}
                                placeholder="새 비밀번호 입력"
                                error={errors.newPassword}
                                onChange={(event) => {
                                    setNewPassword(event.target.value)
                                    setErrors((current) => ({
                                        ...current,
                                        newPassword: undefined,
                                    }))
                                }}
                            />
                            <p>영문 + 숫자 + 특수문자 포함 8~20자</p>
                        </div>

                        <Input
                            label="새 비밀번호 확인"
                            type="password"
                            value={newPasswordConfirm}
                            placeholder="새 비밀번호 다시 입력"
                            error={errors.newPasswordConfirm}
                            onChange={(event) => {
                                setNewPasswordConfirm(event.target.value)
                                setErrors((current) => ({
                                    ...current,
                                    newPasswordConfirm: undefined,
                                }))
                            }}
                        />
                    </>
                )}
            </form>

            <div className={styles.saveArea}>
                <Button
                    fullWidth
                    type="button"
                    disabled={submitting}
                    onClick={handleOpenSaveModal}
                >
                    변경사항 저장
                </Button>

                {saveMessage && (
                    <p className={styles.saveMessage}>
                        {saveMessage}
                    </p>
                )}
            </div>

            <Modal
                open={isSaveConfirmOpen}
                icon="success"
                title="변경 사항 저장"
                description="변경 사항을 저장하시겠습니까?"
                cancelLabel="취소"
                onCancel={() => setIsSaveConfirmOpen(false)}
                confirmLabel={submitting ? '저장 중...' : '저장'}
                onConfirm={handleConfirmSave}
            />
        </div>
    )
}

export default ProfileManagePage