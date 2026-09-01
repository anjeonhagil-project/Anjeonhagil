import styles from './Button.module.css'

/**
 * 공통 버튼 컴포넌트
 *
 * variant
 *  - "primary" (기본): 브랜드 메인 버튼.
 *      · disabled === true  → --color-primary-300 (비활성화 상태)
 *      · disabled === false → --color-primary-500-main (활성화 상태)
 *      · 누르는 순간(:active) → --color-primary-600 (완료 상태)
 *    (피그마 "공통 · input 박스와 관련된 버튼 / modal 창의 버튼" 상태 규칙을 그대로 반영)
 *  - "secondary": 모달의 "취소" 버튼처럼 보조 액션에 쓰는 연회색 버튼
 *  - "danger": 로그아웃 · 회원탈퇴처럼 되돌릴 수 없는 액션에 쓰는 빨간 버튼
 *
 * size: "md"(기본, 52px, 폼 하단 CTA용) | "sm"(44px, 모달 2버튼 레이아웃용)
 * fullWidth: 부모 너비를 꽉 채움 (로그인 버튼 등 폼 하단 CTA에서 사용)
 *
 * 사용 예)
 *   <Button fullWidth disabled={!id || !password}>로그인</Button>
 *   <Button variant="danger" size="sm" onClick={handleLogout}>로그아웃</Button>
 */
export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    disabled = false,
    type = 'button',
    onClick,
    className = '',
    ...rest
}) {
    const classNames = [
        styles.button,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <button
            type={type}
            className={classNames}
            disabled={disabled}
            onClick={onClick}
            {...rest}
        >
            {children}
        </button>
    )
}
