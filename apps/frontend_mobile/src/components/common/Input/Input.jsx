import { useState } from 'react'
import styles from './Input.module.css'

// 비밀번호 노출 (눈 뜬 아이콘)
function EyeIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
        </svg>
    )
}

// 비밀번호 미노출 (눈 감은 아이콘)
function EyeOffIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M6.6 6.7C3.9 8.3 2 11.5 2 12s4 7 11 7c1.6 0 3-.3 4.2-.9M17.3 17.3C19.4 15.9 21 13.5 21 12s-4-7-11-7c-.7 0-1.4.06-2 .18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

/**
 * 공통 텍스트 입력 컴포넌트
 *
 * type="password"로 주면 오른쪽에 눈 아이콘이 자동으로 붙어서
 * 평문 보기/숨기기를 토글할 수 있음 (m-auth-002 로그인 화면 기준).
 *
 * error: 문자열을 넘기면 테두리가 danger 색으로 바뀌고 아래에 에러 문구가 표시됨
 *   (예: "아이디, 이메일 중복 및 비밀번호 미일치")
 * hideErrorText: true면 테두리는 그대로 danger 색이 되지만 내부 에러 문구는 렌더링하지 않음
 *   (버튼과 한 줄에 나란히 두는 등, 에러 문구를 바깥에서 직접 그리고 싶을 때 사용)
 *
 * 사용 예)
 *   <Input label="아이디" placeholder="아이디를 입력해주세요" value={id} onChange={(e) => setId(e.target.value)} />
 *   <Input label="비밀번호" type="password" placeholder="비밀번호를 입력해주세요" value={pw} onChange={...} error={pwError} />
 */
export default function Input({
    label,
    type = 'text',
    placeholder,
    value,
    onChange,
    error,
    hideErrorText = false,
    disabled = false,
    id,
    ...rest
}) {
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type
    const inputId = id || label

    const wrapClassNames = [
        styles.inputWrap,
        error ? styles.errorWrap : '',
        disabled ? styles.disabledWrap : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={styles.field}>
            {label && (
                <label htmlFor={inputId} className={styles.label}>
                    {label}
                </label>
            )}
            <div className={wrapClassNames}>
                <input
                    id={inputId}
                    type={inputType}
                    className={styles.input}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    {...rest}
                />
                {isPassword && (
                    <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                )}
            </div>
            {error && !hideErrorText && <p className={styles.errorText}>{error}</p>}
        </div>
    )
}
