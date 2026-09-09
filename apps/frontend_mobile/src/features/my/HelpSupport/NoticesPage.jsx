import { FiChevronRight } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import Header from '../../../components/layout/Header.jsx'
import styles from './NoticesPage.module.css'

const NOTICES = [
    { id: 1, title: '안전하길 서비스 정식 오픈 안내', date: '2025.01.15' },
    { id: 2, title: '개인정보 처리방침 개정 안내', date: '2025.01.10' },
    { id: 3, title: '안심경로 알고리즘 업데이트 안내', date: '2025.01.05' },
    { id: 4, title: '겨울철 안전 운전 가이드', date: '2024.12.20' },
    { id: 5, title: '위치기반서비스 이용약관 변경 안내', date: '2024.12.15' },
    { id: 6, title: '앱 버전 1.2.0 업데이트 안내', date: '2024.12.10' },
    { id: 7, title: '연말 시스템 점검 안내', date: '2024.12.05' },
    { id: 8, title: '연말 시스템 점검 안내', date: '2024.12.05' },
    { id: 9, title: '연말 시스템 점검 안내', date: '2024.12.05' },
    { id: 10, title: '연말 시스템 점검 안내', date: '2024.12.05' },
    { id: 11, title: '연말 시스템 점검 안내', date: '2024.12.05' },
    { id: 12, title: '연말 시스템 점검 안내', date: '2024.12.05' },
    { id: 13, title: '연말 시스템 점검 안내', date: '2024.12.05' },
]

function NoticesPage() {
    const navigate = useNavigate()

    const handleNoticeClick = (noticeId) => {
        // 공지 상세 화면을 만든 뒤 연결합니다.
        // navigate(`/my/support/notices/${noticeId}`)
        console.log('선택한 공지 ID:', noticeId)
    }

    return (
        <main className={styles.page}>
            <Header title="공지사항" onBack={() => navigate('/my/support')} />

            <section className={`${styles.content} hide-scrollbar`} aria-label="공지사항 목록">
                <div className={styles.noticeList}>
                    {NOTICES.map((notice) => (
                        <button
                            key={notice.id}
                            type="button"
                            className={styles.noticeItem}
                            onClick={() => handleNoticeClick(notice.id)}
                        >
                            <span className={styles.noticeCopy}>
                                <strong>{notice.title}</strong>
                                <time>{notice.date}</time>
                            </span>

                            <FiChevronRight size={20} aria-hidden="true" />
                        </button>
                    ))}
                </div>
            </section>
        </main>
    )
}

export default NoticesPage