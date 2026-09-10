import styles from './MemberDetailModal.module.css'


export default function MemberDetailModal({
    member,
    isLoading,
    errorMessage,
    canManageAdmins,
    onEditPermission,
    onClose,
}) {
    function formatDate(value) {
        if (!value) {
            return '-'
        }

        return new Date(value).toLocaleString(
            'ko-KR'
        )
    }


    function getRoleLabel(role) {
        if (role === 'super_admin') {
            return '최고 관리자'
        }

        if (role === 'admin') {
            return '관리자'
        }

        return '일반 회원'
    }


    function getRoleBadgeClass(role) {
        if (role === 'super_admin') {
            return styles.superAdminBadge
        }

        if (role === 'admin') {
            return styles.adminBadge
        }

        return styles.userBadge
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
                aria-labelledby="member-detail-title"
            >
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.titleArea}>
                        <h2
                            id="member-detail-title"
                            className={styles.title}
                        >
                            회원 상세 정보
                        </h2>

                        <p className={styles.subtitle}>
                            회원의 계정 및 서비스 이용 정보를
                            확인합니다.
                        </p>
                    </div>

                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="회원 상세 팝업 닫기"
                    >
                        ×
                    </button>
                </div>


                {/* Loading */}
                {isLoading ? (
                    <div className={styles.messageArea}>
                        회원 상세 정보를 불러오는 중입니다...
                    </div>
                ) : errorMessage ? (
                    <div className={styles.messageArea}>
                        {errorMessage}
                    </div>
                ) : !member ? (
                    <div className={styles.messageArea}>
                        회원 정보가 없습니다.
                    </div>
                ) : (
                    <>
                        <div className={styles.body}>
                            {/* 기본 회원 정보 */}
                            <section className={styles.section}>
                                <h3 className={styles.sectionTitle}>
                                    기본 정보
                                </h3>

                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            아이디
                                        </span>

                                        <span className={styles.value}>
                                            {member.username ?? '-'}
                                        </span>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            이메일
                                        </span>

                                        <span className={styles.value}>
                                            {member.email ?? '-'}
                                        </span>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            닉네임
                                        </span>

                                        <span className={styles.value}>
                                            {member.nickname ?? '-'}
                                        </span>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            가입 유형
                                        </span>

                                        <span className={styles.value}>
                                            {member.signupProvider ?? '-'}
                                        </span>
                                    </div>
                                </div>
                            </section>


                            {/* 서비스 이용 정보 */}
                            <section className={styles.section}>
                                <h3 className={styles.sectionTitle}>
                                    서비스 이용 정보
                                </h3>

                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            회원 상태
                                        </span>

                                        <span
                                            className={[
                                                styles.badge,
                                                member.isActive
                                                    ? styles.activeBadge
                                                    : styles.inactiveBadge,
                                            ].join(' ')}
                                        >
                                            {member.isActive
                                                ? '활성'
                                                : '탈퇴'}
                                        </span>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            온보딩
                                        </span>

                                        <span className={styles.value}>
                                            {member.onboarding
                                                ? '완료'
                                                : '미완료'}
                                        </span>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            가입일
                                        </span>

                                        <span className={styles.value}>
                                            {formatDate(
                                                member.createdAt
                                            )}
                                        </span>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            탈퇴일
                                        </span>

                                        <span className={styles.value}>
                                            {formatDate(
                                                member.withdrawnAt
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </section>


                            {/* 관리자 정보 */}
                            <section className={styles.section}>
                                <h3 className={styles.sectionTitle}>
                                    권한 정보
                                </h3>

                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            현재 권한
                                        </span>

                                        <span
                                            className={[
                                                styles.badge,
                                                getRoleBadgeClass(
                                                    member.role
                                                ),
                                            ].join(' ')}
                                        >
                                            {getRoleLabel(
                                                member.role
                                            )}
                                        </span>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            권한 상태
                                        </span>

                                        <span className={styles.value}>
                                            {member.admin
                                                ? member.admin.isActive
                                                    ? '활성'
                                                    : '비활성'
                                                : '일반 회원'}
                                        </span>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            권한 부여일
                                        </span>

                                        <span className={styles.value}>
                                            {formatDate(
                                                member.admin
                                                    ?.grantedAt
                                            )}
                                        </span>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <span className={styles.label}>
                                            최근 관리자 로그인
                                        </span>

                                        <span className={styles.value}>
                                            {formatDate(
                                                member.admin
                                                    ?.lastLoginAt
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </section>
                        </div>


                        {/* Footer */}
                        <div className={styles.footer}>
                            {canManageAdmins && member.role !== 'super_admin' && (
                                <button
                                    type="button"
                                    className={styles.closeActionButton}
                                    onClick={onEditPermission}
                                >
                                    권한 수정
                                </button>
                            )}
                            <button
                                type="button"
                                className={styles.closeActionButton}
                                onClick={onClose}
                            >
                                닫기
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}