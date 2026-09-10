import styles from './PermissionResultModal.module.css'


export default function PermissionResultModal({
    type,
    member,
    nextRole,
    onClose,
}) {
    const isSuccess = type === 'success'


    function getRoleLabel(role) {
        if (role === 'admin') {
            return '관리자'
        }

        return '일반 회원'
    }


    function handleOverlayClick(event) {
        if (event.target === event.currentTarget) {
            onClose()
        }
    }


    return (
        <div
            className={styles.overlay}
            onClick={handleOverlayClick}
        >
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="permission-result-title"
            >
                <div className={styles.body}>
                    <div
                        className={[
                            styles.icon,
                            isSuccess
                                ? styles.successIcon
                                : styles.errorIcon,
                        ].join(' ')}
                        aria-hidden="true"
                    >
                        {isSuccess ? '✓' : '!'}
                    </div>

                    <h2
                        id="permission-result-title"
                        className={styles.title}
                    >
                        {isSuccess
                            ? '관리자 권한 수정 완료'
                            : '관리자 권한 수정 실패'}
                    </h2>

                    {isSuccess ? (
                        <p className={styles.message}>
                            <span className={styles.highlight}>
                                {member?.username ??
                                    member?.email ??
                                    '선택 회원'}
                            </span>
                            {' '}회원의 권한이
                            <br />

                            <span className={styles.highlight}>
                                {getRoleLabel(nextRole)}
                            </span>
                            (으)로 변경되었습니다.
                        </p>
                    ) : (
                        <p className={styles.message}>
                            권한 변경 중 문제가 발생했습니다.
                            <br />
                            다시 시도해주세요.
                        </p>
                    )}
                </div>

                <div className={styles.footer}>
                    <button
                        type="button"
                        className={styles.confirmButton}
                        onClick={onClose}
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    )
}