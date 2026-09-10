import styles from './LoginFailureModal.module.css'


export default function LoginFailureModal({
    message,
    onClose,
}) {
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
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="login-failure-title"
            >
                <div className={styles.body}>
                    <div
                        className={styles.icon}
                        aria-hidden="true"
                    >
                        !
                    </div>

                    <h2
                        id="login-failure-title"
                        className={styles.title}
                    >
                        로그인 실패
                    </h2>

                    <p className={styles.message}>
                        {message}
                    </p>
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