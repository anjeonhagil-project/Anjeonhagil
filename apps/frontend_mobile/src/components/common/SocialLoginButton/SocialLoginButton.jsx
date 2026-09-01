import styles from './SocialLoginButton.module.css'

function NaverIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M11.5 2v6.4L6.5 2H2v14h4.5V9.6L11.5 16H16V2h-4.5Z" fill="currentColor" />
        </svg>
    )
}

function KakaoIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <ellipse cx="10" cy="9.2" rx="7.5" ry="6" fill="currentColor" />
            <path d="M6.3 16.8 5.2 20l4.2-2.6" fill="currentColor" />
        </svg>
    )
}

function GoogleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path
                d="M19.6 10.2c0-.7-.06-1.36-.18-2H10v3.79h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.33 2.99-7.31Z"
                fill="#4285F4"
            />
            <path
                d="M10 20c2.7 0 4.96-.9 6.61-2.44l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.59-4.11H1.06v2.58A10 10 0 0 0 10 20Z"
                fill="#34A853"
            />
            <path
                d="M4.41 11.9A5.99 5.99 0 0 1 4.09 10c0-.66.11-1.3.32-1.9V5.52H1.06A10 10 0 0 0 0 10c0 1.61.39 3.14 1.06 4.48l3.35-2.58Z"
                fill="#FBBC05"
            />
            <path
                d="M10 3.98c1.47 0 2.79.5 3.83 1.49l2.87-2.87C14.95.99 12.7 0 10 0 6.09 0 2.71 2.24 1.06 5.52l3.35 2.58C5.2 5.74 7.4 3.98 10 3.98Z"
                fill="#EA4335"
            />
        </svg>
    )
}

const PROVIDER = {
    naver: { label: '네이버로 로그인', className: 'naver', icon: <NaverIcon /> },
    kakao: { label: '카카오로 로그인', className: 'kakao', icon: <KakaoIcon /> },
    google: { label: '구글로 로그인', className: 'google', icon: <GoogleIcon /> },
}

/**
 * 소셜 로그인 원형 아이콘 버튼 (m-auth-002 "또는 간편 로그인" 영역)
 *
 * ⚠️ 아이콘은 자리 표시용 간이 SVG입니다. 실제 배포 전에는 각 플랫폼의
 *    공식 브랜드 가이드 SVG(네이버/카카오/구글 로그인 버튼 가이드라인)로 교체해주세요.
 *
 * 사용 예)
 *   <SocialLoginButton provider="google" onClick={handleGoogleLogin} />
 */
export default function SocialLoginButton({ provider, onClick }) {
    const conf = PROVIDER[provider]
    if (!conf) return null

    return (
        <button
            type="button"
            className={[styles.circleButton, styles[conf.className]].join(' ')}
            onClick={onClick}
            aria-label={conf.label}
        >
            {conf.icon}
        </button>
    )
}
