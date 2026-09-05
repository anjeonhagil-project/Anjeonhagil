import naverIcon from '../../../assets/icons/NAVER_login_Light_KR_green_icon_H48.png'
import googleIcon from '../../../assets/icons/Theme=Light, Show text=No, Shape=Pill, Platform=Android+Web.png'
import styles from './SocialLoginButton.module.css'

function KakaoIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <ellipse cx="10" cy="9.2" rx="7.5" ry="6" fill="currentColor" />
            <path d="M6.3 16.8 5.2 20l4.2-2.6" fill="currentColor" />
        </svg>
    )
}

const PROVIDER = {
    naver: { label: '네이버로 로그인', className: 'naver', icon: <img src={naverIcon} alt="" className={styles.naverIcon} /> },
    kakao: { label: '카카오로 로그인', className: 'kakao', icon: <KakaoIcon /> },
    google: { label: '구글로 로그인', className: 'google', icon: <img src={googleIcon} alt="" className={styles.googleIcon} /> },
}

/**
 * 소셜 로그인 원형 아이콘 버튼 (m-auth-002 "또는 간편 로그인" 영역)
 *
 * ⚠️ 카카오 아이콘은 자리 표시용 간이 SVG입니다. 실제 배포 전에는
 *    공식 브랜드 가이드 아이콘으로 교체해주세요. (네이버/구글은 공식 아이콘 적용 완료)
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
