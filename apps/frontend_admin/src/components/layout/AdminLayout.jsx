import { Outlet } from 'react-router-dom'
import styles from './AdminLayout.module.css'

function AdminLayout() {
    return (
        <div className={styles.layout}>
            <aside className={styles.sidebar}>
                임시 사이드바
            </aside>

            <div className={styles.mainArea}>
                <header className={styles.header}>
                    임시 헤더
                </header>

                <main className={styles.content}>
                    <Outlet /> {/* 대시보드, 회우너관리, 데이터 관리 화면 등 */}
                </main>
            </div>
        </div>
    )
}

export default AdminLayout