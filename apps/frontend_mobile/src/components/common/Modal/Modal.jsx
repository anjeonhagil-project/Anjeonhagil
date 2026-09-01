import Button from '../Button/Button'
import styles from './Modal.module.css'

function WarningIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 7v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1" fill="currentColor" />
        </svg>
    )
}

function SuccessIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function EditIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 20h4l10-10-4-4L4 16v4Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

const ICONS = {
    warning: <WarningIcon />,
    success: <SuccessIcon />,
    edit: <EditIcon />,
}

/**
 * 공통 모달(다이얼로그) 컴포넌트 (modal-card 참고)
 *
 * icon: "warning"(빨강, 실패/삭제/경고) | "success"(초록, 성공/완료/저장) | "edit"(변경) | 생략 가능
 * title / description: 제목과 보조 설명 텍스트
 * confirmLabel, onConfirm: 주 액션 버튼. danger=true면 빨간 버튼(로그아웃 · 회원탈퇴 등)으로 렌더
 * cancelLabel, onCancel: 값을 주면 "취소 + 확인" 2버튼 레이아웃, 안 주면 확인 버튼 1개가 꽉 채움
 * linkLabel, onLinkClick: 버튼 아래 보조 텍스트 링크 (예: "이전 화면으로 돌아가기")
 * open: 표시 여부. backdrop(바깥 영역) 클릭 시 onCancel(없으면 onConfirm)이 호출됨
 *
 * 사용 예)
 *   // 단일 확인 모달
 *   <Modal open={open} icon="success" title="즐겨찾기 저장" description="즐겨찾기가 저장되었습니다."
 *          confirmLabel="확인" onConfirm={close} />
 *
 *   // 취소/확인 2버튼 + 파괴적 액션
 *   <Modal open={open} icon="warning" title="회원탈퇴"
 *          description={'회원탈퇴를 진행하시겠습니까?\n탈퇴 시 계정 정보와 저장된 데이터가 모두 삭제되며 복구할 수 없습니다.'}
 *          cancelLabel="취소" onCancel={close}
 *          confirmLabel="회원탈퇴" onConfirm={handleWithdraw} danger />
 */
export default function Modal({
    open,
    icon,
    title,
    description,
    confirmLabel = '확인',
    onConfirm,
    cancelLabel,
    onCancel,
    danger = false,
    linkLabel,
    onLinkClick,
}) {
    if (!open) return null

    const handleBackdropClick = () => {
        (onCancel || onConfirm)?.()
    }

    return (
        <div className={styles.backdrop} role="presentation" onClick={handleBackdropClick}>
            <div
                className={styles.card}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'modal-title' : undefined}
                onClick={(e) => e.stopPropagation()}
            >
                {icon && <div className={[styles.iconCircle, styles[icon]].join(' ')}>{ICONS[icon]}</div>}
                {title && (
                    <h2 id="modal-title" className={styles.title}>
                        {title}
                    </h2>
                )}
                {description && <p className={styles.description}>{description}</p>}
                <div className={styles.actions}>
                    {cancelLabel && (
                        <Button variant="secondary" size="sm" onClick={onCancel}>
                            {cancelLabel}
                        </Button>
                    )}
                    <Button
                        variant={danger ? 'danger' : 'primary'}
                        size={cancelLabel ? 'sm' : 'md'}
                        fullWidth={!cancelLabel}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </div>
                {linkLabel && (
                    <button type="button" className={styles.link} onClick={onLinkClick}>
                        {linkLabel}
                    </button>
                )}
            </div>
        </div>
    )
}
