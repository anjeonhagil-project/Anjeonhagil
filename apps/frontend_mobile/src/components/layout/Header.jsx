// 기능: 뒤로가기 + 가운데 정렬 타이틀 공통 헤더
import styles from './Header.module.css'

// 뒤로가기 아이콘
function BackIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

// 상단 헤더
function Header({ title, onBack }) {
    return (
        <header className={styles.header}>
            <button type="button" className={styles.backButton} onClick={onBack} aria-label="뒤로가기">
                <BackIcon />
            </button>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.spacer} />
        </header>
    )
}

export default Header
