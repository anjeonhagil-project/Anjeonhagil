import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../../../components/layout/Header.jsx'
import { getMyInquiry } from '../../support/api.js'
import styles from './SupportDetailPage.module.css'

function formatDate(value) {
    return value
        ? new Date(value).toLocaleDateString('sv-SE').replaceAll('-', '.')
        : ''
}

function InquiryDetailPage() {
    const navigate = useNavigate()
    const { inquiryId } = useParams()
    const [inquiry, setInquiry] = useState(null)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        let isMounted = true

        getMyInquiry(inquiryId)
            .then((result) => {
                if (isMounted) setInquiry(result)
            })
            .catch((error) => {
                if (isMounted) setErrorMessage(error.message || '문의 내용을 불러오지 못했습니다')
            })

        return () => {
            isMounted = false
        }
    }, [inquiryId])

    const isAnswered = inquiry?.status === 'answered'

    return (
        <main className={styles.page}>
            <Header title="문의" onBack={() => navigate('/my/support/inquiries')} />
            <section className={`${styles.content} hide-scrollbar`}>
                {!inquiry && <p className={styles.feedback}>{errorMessage || '문의 내용을 불러오는 중입니다.'}</p>}
                {inquiry && (
                    <>
                        <article className={styles.card}>
                            <div className={styles.heading}>
                                <h2>{inquiry.title}</h2>
                                <span className={isAnswered ? styles.statusAnswered : styles.statusWaiting}>
                                    {inquiry.statusLabel}
                                </span>
                            </div>
                            <time className={styles.date}>{formatDate(inquiry.createdAt)}</time>
                            <p className={styles.body}>{inquiry.content}</p>
                        </article>

                        <article className={styles.card}>
                            <h2 className={styles.answerTitle}>관리자 답변</h2>
                            {isAnswered ? (
                                <>
                                    <time className={styles.date}>{formatDate(inquiry.answeredAt)}</time>
                                    <p className={styles.body}>{inquiry.answerContent}</p>
                                </>
                            ) : (
                                <p className={styles.body}>관리자가 문의를 확인한 뒤 답변을 남겨드립니다.</p>
                            )}
                        </article>
                    </>
                )}
            </section>
        </main>
    )
}

export default InquiryDetailPage
