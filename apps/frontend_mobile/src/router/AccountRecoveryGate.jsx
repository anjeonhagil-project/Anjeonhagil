import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/common/index.js'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../hooks/useAuth.js'
import { restoreMyAccount } from '../features/my/api.js'

function AccountRecoveryGate() {
    const navigate = useNavigate()
    const { isAuthenticated, accountStatus, loading } = useAuth()
    const [isRestoring, setIsRestoring] = useState(false)
    const [error, setError] = useState('')

    const shouldShowRecovery =
        isAuthenticated &&
        !loading &&
        accountStatus?.isActive === false &&
        accountStatus?.canRestore === true

    const handleCancel = async () => {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
    }

    const handleRestore = async () => {
        if (isRestoring) return

        setIsRestoring(true)
        setError('')

        try {
            await restoreMyAccount()

            // 새로고침 후 활성 계정 상태를 다시 불러옴
            window.location.assign('/home')
        } catch (restoreError) {
            setError(
                restoreError.message ||
                '계정 복구에 실패했습니다. 다시 시도해주세요.'
            )
            setIsRestoring(false)
        }
    }

    return (
        <Modal
            open={shouldShowRecovery}
            icon="edit"
            title="탈퇴한 계정입니다"
            description={
                error ||
                '탈퇴 후 30일 이내에는 계정을 복구할 수 있습니다.\n계정을 복구하시겠습니까?'
            }
            cancelLabel="로그아웃"
            onCancel={handleCancel}
            confirmLabel={
                isRestoring ? '복구 중...' : '계정 복구'
            }
            onConfirm={handleRestore}
        />
    )
}

export default AccountRecoveryGate