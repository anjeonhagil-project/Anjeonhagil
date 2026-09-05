import { Outlet } from 'react-router-dom'
import styles from './AdminLayout.module.css'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'

function AdminLayout() {
    return (
        <div className={styles.layout}>
            <AdminSidebar />

            <div className={styles.mainArea}>
                <AdminHeader />

                <main className={styles.content}>
                    <Outlet /> {/* 대시보드, 회우너관리, 데이터 관리 화면 등 */}
                </main>
            </div>
        </div>
    )
}

export default AdminLayout