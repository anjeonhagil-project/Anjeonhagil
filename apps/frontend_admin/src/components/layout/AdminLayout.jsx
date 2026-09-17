import { Outlet, useOutletContext } from 'react-router-dom'
import styles from './AdminLayout.module.css'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'

function AdminLayout() {
    const {admin} = useOutletContext()
    return (
        <div className={styles.layout}>
            <AdminSidebar admin={admin} />

            <div className={styles.mainArea}>
                <AdminHeader admin={admin} />

                <main className={styles.content}>
                    <Outlet context={{admin}} />
                </main>
            </div>
        </div>
    )
}

export default AdminLayout
