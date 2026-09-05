// 기능: 홈/검색/저장/MY 하단 탭 네비게이션
import { useLocation, useNavigate } from 'react-router-dom'
import { IoHome, IoHomeOutline, IoSearchOutline, IoHeart, IoHeartOutline, IoPerson, IoPersonOutline } from 'react-icons/io5'
import styles from './BottomNav.module.css'

const TABS = [
    { path: '/home', label: '홈', Icon: IoHomeOutline, ActiveIcon: IoHome },
    { path: '/search', label: '검색', Icon: IoSearchOutline, ActiveIcon: IoSearchOutline },
    { path: '/favorites', label: '저장', Icon: IoHeartOutline, ActiveIcon: IoHeart },
    { path: '/my', label: 'MY', Icon: IoPersonOutline, ActiveIcon: IoPerson },
]

function BottomNav() {
    const location = useLocation()
    const navigate = useNavigate()

    return (
        <nav className={styles.nav}>
            {TABS.map(({ path, label, Icon, ActiveIcon }) => {
                const active = location.pathname === path
                const TabIcon = active ? ActiveIcon : Icon

                return (
                    <button
                        key={path}
                        type="button"
                        className={active ? `${styles.tab} ${styles.active}` : styles.tab}
                        onClick={() => navigate(path)}
                    >
                        <TabIcon size={22} />
                        <span>{label}</span>
                    </button>
                )
            })}
        </nav>
    )
}

export default BottomNav
