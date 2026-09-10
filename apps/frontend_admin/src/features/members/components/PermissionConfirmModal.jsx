import styles from './PermissionConfirmModal.module.css'


export default function PermissionConfirmModal({
    member,
    currentRole,
    nextRole,
    isSubmitting,
    onCancel,
    onConfirm,
}) {
    function getRoleLabel(role) {
        if (role === 'admin') {
            return '관리자'
        }

        return '일반 회원'
    }


    function handleOverlayClick(event) {
        if (
            event.target === event.currentTarget &&
            !isSubmitting
        ) {
            onCancel()
        }
    }


    if (!member) {
        return null
    }


    return (
        <div
            className={styles.overlay}
            onClick={handleOverlayClick}
        >
            <div
                className={styles.modal}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="permission-confirm-title"
            >
                <div className={styles.body}>
                    <div
                        className={styles.icon}
                        aria-hidden="true"
                    >
                        !
                    </div>

                    <h2
                        id="permission-confirm-title"
                        className={styles.title}
                    >
                        수정하시겠습니까?
                    </h2>

                    <p className={styles.message}>
                        <span className={styles.highlight}>
                            {member.username ?? member.email ?? '선택 회원'}
                        </span>
                        {' '}회원의 권한을
                        <br />

                        <span className={styles.highlight}>
                            {getRoleLabel(currentRole)}
                        </span>

                        {' → '}

                        <span className={styles.highlight}>
                            {getRoleLabel(nextRole)}
                        </span>

                        (으)로 변경합니다.
                    </p>
                </div>


                <div className={styles.footer}>
                    <button
                        type="button"
                        className={styles.cancelButton}
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        취소
                    </button>

                    <button
                        type="button"
                        className={styles.confirmButton}
                        onClick={onConfirm}
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? '처리 중...'
                            : '확인'}
                    </button>
                </div>
            </div>
        </div>
    )
}