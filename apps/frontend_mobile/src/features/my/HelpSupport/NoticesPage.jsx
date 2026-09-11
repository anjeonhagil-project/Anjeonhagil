import { useEffect, useState } from 'react'
import { FiChevronRight } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import Header from '../../../components/layout/Header.jsx'
import { getNotices } from '../../support/api.js'
import styles from './NoticesPage.module.css'

function formatDate(value) {
    return value
        ? new Date(value).toLocaleDateString('sv-SE').replaceAll('-', '.')
        : ''
}

function NoticesPage() {
    const navigate = useNavigate()
    const [notices, setNotices] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        let isMounted = true

        getNotices()
            .then((result) => {
                if (isMounted) setNotices(result.items ?? [])
            })
            .catch((error) => {
                if (isMounted) setErrorMessage(error.message || '공지사항을 불러오지 못했습니다')
            })
            .finally(() => {
                if (isMounted) setIsLoading(false)
            })

        return () => {
            isMounted = false
        }
    }, [])

    const handleNoticeClick = (noticeId) => {
        navigate(`/my/support/notices/${noticeId}`)
    }

    return (
        <main className={styles.page}>
            <Header title="공지사항" onBack={() => navigate('/my/support')} />

            <section className={`${styles.content} hide-scrollbar`} aria-label="공지사항 목록">
                <div className={styles.noticeList}>
                    {isLoading && <p className={styles.feedback}>공지사항을 불러오는 중입니다.</p>}
                    {!isLoading && errorMessage && <p className={styles.feedback}>{errorMessage}</p>}
                    {!isLoading && !errorMessage && notices.length === 0 && (
                        <p className={styles.feedback}>게시된 공지사항이 없습니다.</p>
                    )}
                    {!isLoading && !errorMessage && notices.map((notice) => (
                        <button
                            key={notice.noticeId}
                            type="button"
                            className={styles.noticeItem}
                            onClick={() => handleNoticeClick(notice.noticeId)}
                        >
                            <span className={styles.noticeCopy}>
                                <strong>{notice.title}</strong>
                                <time>{formatDate(notice.publishedAt)}</time>
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
