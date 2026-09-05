import { NavLink, useLocation } from 'react-router-dom'

import { adminNavigation } from '../../config/adminNavigation'

import styles from './AdminSidebar.module.css'

function AdminSidebar() {
    const location = useLocation()

    return (
        <aside className={styles.sidebar}>
            {/* Logo */}
            <NavLink
                to="/dashboard"
                className={styles.logoArea}
            >
                <img
                    src="/brand/logo_text.png"
                    alt="안전하길"
                    className={styles.logo}
                />
            </NavLink>

            {/* Navigation */}
            <nav className={styles.navigation}>
                {adminNavigation.map((menu) => {
                    const Icon = menu.icon
                    const hasChildren = menu.children?.length > 0

                    /* 하위 메뉴가 없는 일반 메뉴 */
                    if (!hasChildren) {
                        return (
                            <NavLink
                                key={menu.path}
                                to={menu.path}
                                className={({ isActive }) =>
                                    `${styles.menuItem} ${
                                        isActive ? styles.active : ''
                                    }`
                                }
                            >
                                {Icon && (
                                    <Icon
                                        className={styles.menuIcon}
                                        aria-hidden="true"
                                    />
                                )}

                                <span>{menu.label}</span>
                            </NavLink>
                        )
                    }

                    /* 하위 메뉴가 있는 메뉴 */
                    const isParentActive =
                        location.pathname.startsWith(menu.path)

                    return (
                        <div
                            key={menu.label}
                            className={styles.menuGroup}
                        >
                            {/* 부모 메뉴 - 데이터 관리 */}
                            <NavLink
                                to={menu.path}
                                end
                                className={({ isActive }) =>
                                    `${styles.menuItem} ${
                                        isActive
                                            ? styles.active
                                            : ''
                                    } ${
                                        isParentActive && !isActive
                                            ? styles.parentActive
                                            : ''
                                    }`
                                }
                            >
                                {Icon && (
                                    <Icon
                                        className={styles.menuIcon}
                                        aria-hidden="true"
                                    />
                                )}

                                <span>{menu.label}</span>
                            </NavLink>

                            {/* 하위 메뉴 */}
                            <div className={styles.subNavigation}>
                                {menu.children.map((child) => (
                                    <NavLink
                                        key={child.path}
                                        to={child.path}
                                        className={({ isActive }) =>
                                            `${styles.subMenuItem} ${
                                                isActive
                                                    ? styles.subActive
                                                    : ''
                                            }`
                                        }
                                    >
                                        <span
                                            className={
                                                styles.subMenuDot
                                            }
                                        />

                                        <span>{child.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </nav>

            {/* Sidebar Footer */}
            <div className={styles.sidebarFooter}>
                <span className={styles.accountLabel}>
                    Super Admin 계정
                </span>

                <span className={styles.version}>
                    v1.2.0 (Stable)
                </span>
            </div>
        </aside>
    )
}

export default AdminSidebar