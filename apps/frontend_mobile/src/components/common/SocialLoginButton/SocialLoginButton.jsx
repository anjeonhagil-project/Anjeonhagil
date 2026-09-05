import naverIcon from '../../../assets/icons/NAVER_login_Light_KR_green_icon_H48.png'
import googleIcon from '../../../assets/icons/Theme=Light, Show text=No, Shape=Pill, Platform=Android+Web.png'
import kakaoIcon from '../../../assets/icons/kakao.png'
import styles from './SocialLoginButton.module.css'

const PROVIDER = {
    naver: { label: '네이버로 로그인', className: 'naver', icon: <img src={naverIcon} alt="" className={styles.naverIcon} /> },
    kakao: { label: '카카오로 로그인', className: 'kakao', icon: <img src={kakaoIcon} alt="" className={styles.kakaoIcon} /> },
    google: { label: '구글로 로그인', className: 'google', icon: <img src={googleIcon} alt="" className={styles.googleIcon} /> },
}

/**
 * 소셜 로그인 원형 아이콘 버튼 (m-auth-002 "또는 간편 로그인" 영역)
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
