import { useLocation, useNavigate } from "react-router-dom"

import { adminNavigation } from "../../config/adminNavigation"
import { logoutAdmin } from "../../features/auth/api.js"

import styles from "./AdminHeader.module.css"

function AdminHeader() {
    const location = useLocation();
    const navigate = useNavigate();

    const currentMenu = adminNavigation.find(
        (menu) => menu.children
        ? location.pathname.startsWith(menu.path)
        : menu.path === location.pathname,
    );

    const pageTitle = currentMenu?.label ?? "관리자";

    const handleLogout = async () => {
        try {
            await logoutAdmin()

            navigate('/login', {
                replace: true,
            })
        } catch (error) {
            console.error('관리자 로그아웃 실패:', error)
        }
    }

    return (
        <header className={styles.header}>
            <h1 className={styles.pageTitle}>
                {pageTitle}
            </h1>

            <div className={styles.rightArea}>
                <div className={styles.systemStatus}>
                    <span className={styles.statusDot} />
                    <span>시스템 정상</span>
                </div>

                <div className={styles.adminProfile}>
                    <div className={styles.avatar}>
                        AD
                    </div>

                    <span className={styles.adminName}>
                        최고 관리자
                    </span>
                </div>

                <button
                    type="button"
                    className={styles.logoutButton}
                    onClick={handleLogout}
                >
                    로그아웃
                </button>
            </div>
        </header>
    );
}

export default AdminHeader