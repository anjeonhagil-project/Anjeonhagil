import { useState } from 'react'
import { FiChevronRight } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient.js'
import { useAuth } from '../../hooks/useAuth.js'
import BottomNav from '../../components/layout/BottomNav.jsx'
import ProfilePasswordModal from './Modal/ProfilePasswordModal.jsx'
import styles from './MyPage.module.css'

const MENU_ITEMS = [
    {
        id: 'profile',
        title: '프로필 관리',
        description: '닉네임, 비밀번호 변경',
    },
    {
        id: 'survey',
        title: '운전 부담 설문',
        description: '초보 맞춤 길안내 기준 다시 설정',
    },
    {
        id: 'support',
        title: '도움말 / 지원',
        description: '공지사항 / 문의하기 / 약관 및 개인정보',
    },
]

function MyPage() {
    const navigate = useNavigate()
    const { profile, user } = useAuth()
    const [isProfilePasswordOpen, setIsProfilePasswordOpen] = useState(false)

    const nickname =
        profile?.nickname ||
        user?.user_metadata?.nickname ||
        user?.email?.split('@')[0] ||
        '사용자'

    const isEmailLogin = user?.app_metadata?.provider === 'email'

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
    }

    const handleMenuClick = (menuId) => {
        if (menuId !== 'profile') return

        if (isEmailLogin) {
            setIsProfilePasswordOpen(true)
            return
        }

        // 소셜 로그인은 재인증 정책 확정 전까지 바로 진입
        navigate('/my/profile')
    }

    const handleProfileVerified = () => {
        setIsProfilePasswordOpen(false)
        navigate('/my/profile')
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>마이페이지</h1>
            </header>

            <main className={styles.content}>
                <section className={styles.profileCard} aria-label="내 프로필">
                    <img
                        className={styles.profileLogo}
                        src="/brand/logo.png"
                        alt="안전하길"
                    />
                    <div>
                        <strong>{nickname}님</strong>
                        <p>오늘도 안전한 길로 함께해요</p>
                    </div>
                </section>

                <section className={styles.menuList} aria-label="마이페이지 메뉴">
                    {MENU_ITEMS.map((item) => (
                        <button
                            className={styles.menuItem}
                            key={item.id}
                            type="button"
                            onClick={() => handleMenuClick(item.id)}
                        >
                            <span className={styles.menuCopy}>
                                <strong>{item.title}</strong>
                                <small>{item.description}</small>
                            </span>
                            <FiChevronRight aria-hidden="true" size={22} />
                        </button>
                    ))}
                </section>
            </main>

            <div className={styles.accountActions}>
                <button type="button">회원탈퇴</button>
                <span aria-hidden="true" />
                <button type="button" onClick={handleLogout}>
                    로그아웃
                </button>
            </div>

            <BottomNav />

            <ProfilePasswordModal
                open={isProfilePasswordOpen}
                user={user}
                onClose={() => setIsProfilePasswordOpen(false)}
                onVerified={handleProfileVerified}
            />
        </div>
    )
}

export default MyPage