import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../../../components/layout/Header.jsx'
import { getNotice } from '../../support/api.js'
import styles from './SupportDetailPage.module.css'

function formatDate(value) {
    return value
        ? new Date(value).toLocaleDateString('sv-SE').replaceAll('-', '.')
        : ''
}

function NoticeDetailPage() {
    const navigate = useNavigate()
    const { noticeId } = useParams()
    const [notice, setNotice] = useState(null)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        let isMounted = true

        getNotice(noticeId)
            .then((result) => {
                if (isMounted) setNotice(result)
            })
            .catch((error) => {
                if (isMounted) setErrorMessage(error.message || '공지사항을 불러오지 못했습니다')
            })

        return () => {
            isMounted = false
        }
    }, [noticeId])

    return (
        <main className={styles.page}>
            <Header title="공지사항" onBack={() => navigate('/my/support/notices')} />
            <section className={`${styles.content} hide-scrollbar`}>
                {!notice && <p className={styles.feedback}>{errorMessage || '공지사항을 불러오는 중입니다.'}</p>}
                {notice && (
                    <article className={styles.card}>
                        <div className={styles.heading}>
                            <h2>{notice.title}</h2>
                        </div>
                        <time className={styles.date}>{formatDate(notice.publishedAt)}</time>
                        <p className={styles.body}>{notice.content}</p>
                    </article>
                )}
            </section>
        </main>
    )
}

export default NoticeDetailPage
