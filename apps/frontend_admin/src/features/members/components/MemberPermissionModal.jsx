import { useEffect, useState } from 'react'

import styles from './MemberPermissionModal.module.css'


export default function MemberPermissionModal({
    member,
    onClose,
    onSubmit,
}) {
    const [selectedRole, setSelectedRole] = useState('user')


    useEffect(() => {
        if (!member) {
            return
        }

        if (member.role === 'admin') {
            setSelectedRole('admin')
            return
        }

        setSelectedRole('user')
    }, [member])


    function handleOverlayClick(event) {
        if (event.target === event.currentTarget) {
            onClose()
        }
    }


    function handleSubmit(event) {
        event.preventDefault()

        onSubmit(selectedRole)
    }


    if (!member) {
        return null
    }


    const currentRole =
        member.role === 'admin'
            ? 'admin'
            : 'user'

    const isChanged =
        selectedRole !== currentRole


    return (
        <div
            className={styles.overlay}
            onClick={handleOverlayClick}
        >
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="permission-modal-title"
            >
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.titleArea}>
                        <h2
                            id="permission-modal-title"
                            className={styles.title}
                        >
                            관리자 권한 수정
                        </h2>

                        <p className={styles.subtitle}>
                            선택한 회원의 관리자 권한을 변경합니다.
                        </p>
                    </div>

                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="관리자 권한 수정 팝업 닫기"
                    >
                        ×
                    </button>
                </div>


                <form onSubmit={handleSubmit}>
                    <div className={styles.body}>
                        {/* 선택 회원 */}
                        <div className={styles.memberInfo}>
                            <span className={styles.memberName}>
                                {member.username ?? '-'}
                            </span>

                            <span className={styles.memberEmail}>
                                {member.email ?? '-'}
                            </span>
                        </div>


                        {/* 권한 선택 */}
                        <div className={styles.permissionArea}>
                            <span className={styles.label}>
                                관리자 권한
                            </span>

                            <div className={styles.permissionList}>
                                {/* 일반 회원 */}
                                <label
                                    className={[
                                        styles.permissionOption,
                                        selectedRole === 'user'
                                            ? styles.permissionOptionSelected
                                            : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                >
                                    <input
                                        type="radio"
                                        name="admin-role"
                                        value="user"
                                        className={styles.radio}
                                        checked={
                                            selectedRole === 'user'
                                        }
                                        onChange={(event) =>
                                            setSelectedRole(
                                                event.target.value
                                            )
                                        }
                                    />

                                    <span className={styles.permissionText}>
                                        <span
                                            className={
                                                styles.permissionName
                                            }
                                        >
                                            일반 회원
                                        </span>

                                        <span
                                            className={
                                                styles.permissionDescription
                                            }
                                        >
                                            관리자 페이지에 접근할 수
                                            없습니다.
                                        </span>
                                    </span>
                                </label>


                                {/* 관리자 */}
                                <label
                                    className={[
                                        styles.permissionOption,
                                        selectedRole === 'admin'
                                            ? styles.permissionOptionSelected
                                            : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                >
                                    <input
                                        type="radio"
                                        name="admin-role"
                                        value="admin"
                                        className={styles.radio}
                                        checked={
                                            selectedRole === 'admin'
                                        }
                                        onChange={(event) =>
                                            setSelectedRole(
                                                event.target.value
                                            )
                                        }
                                    />

                                    <span className={styles.permissionText}>
                                        <span
                                            className={
                                                styles.permissionName
                                            }
                                        >
                                            관리자
                                        </span>

                                        <span
                                            className={
                                                styles.permissionDescription
                                            }
                                        >
                                            관리자 페이지에 접근할 수
                                            있습니다.
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>


                    {/* Footer */}
                    <div className={styles.footer}>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={onClose}
                        >
                            취소
                        </button>

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={!isChanged}
                        >
                            수정
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}