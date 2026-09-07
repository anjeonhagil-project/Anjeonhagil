// 소셜 로그인 프로필 확인 모달

import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient.js'
import { Modal } from '../../../components/common/index.js'

const PROVIDER_LABELS = {
    google: 'Google',
    kakao: '카카오',
    'custom:naver': '네이버',
}

function SocialReauthModal({ open, user, onClose }) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const provider = user?.app_metadata?.provider
    const providerLabel = PROVIDER_LABELS[provider] || '소셜 계정'

    const handleConfirm = async () => {
        if (!provider || isSubmitting) return

        setIsSubmitting(true)
        setError('')

        try {
            // OAuth 인증 뒤 프로필 관리 화면으로 돌아오기 위한 표시
            window.sessionStorage.setItem(
                'profile_reauth_requested_at',
                String(Date.now())
            )

            const { error: oauthError } =
                await supabase.auth.signInWithOAuth({
                    provider,
                    options: {
                        redirectTo: `${window.location.origin}/my/profile?reauth=1`,
                    },
                })

            if (oauthError) {
                throw oauthError
            }
        } catch (authError) {
            setError(
                authError.message ||
                '소셜 계정 재인증을 시작하지 못했습니다. 다시 시도해주세요.'
            )
            setIsSubmitting(false)
        }
    }

    return (
        <Modal
            open={open}
            icon="edit"
            title="프로필 확인"
            description={
                error ||
                `개인정보 보호를 위해 ${providerLabel} 계정으로 다시 인증해주세요.`
            }
            cancelLabel="취소"
            onCancel={onClose}
            confirmLabel={isSubmitting ? '인증 화면으로 이동 중...' : '인증하기'}
            onConfirm={handleConfirm}
        />
    )
}

export default SocialReauthModal