import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import Button from '../../../components/common/Button/Button.jsx'
import Header from '../../../components/layout/Header.jsx'
import { getMyInquiries } from '../../support/api.js'
import styles from './InquiriesPage.module.css'

function formatDate(value) {
    return value
        ? new Date(value).toLocaleDateString('sv-SE').replaceAll('-', '.')
        : ''
}

function InquiriesPage() {
    const navigate = useNavigate()
    const [inquiries, setInquiries] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        let isMounted = true

        getMyInquiries()
            .then((result) => {
                if (isMounted) setInquiries(result.items ?? [])
            })
            .catch((error) => {
                if (isMounted) setErrorMessage(error.message || '문의 목록을 불러오지 못했습니다')
            })
            .finally(() => {
                if (isMounted) setIsLoading(false)
            })

        return () => {
            isMounted = false
        }
    }, [])

    return (
        <main className={styles.page}>
            <Header title="문의" onBack={() => navigate('/my/support')} />

            <section className={`${styles.content} hide-scrollbar`}>
                <Button
                    fullWidth
                    onClick={() => navigate('/my/support/inquiries/write')}
                >
                    문의 작성
                </Button>

                <div className={styles.inquiryList}>
                    {isLoading && <p className={styles.feedback}>문의 목록을 불러오는 중입니다.</p>}
                    {!isLoading && errorMessage && <p className={styles.feedback}>{errorMessage}</p>}
                    {!isLoading && !errorMessage && inquiries.length === 0 && (
                        <p className={styles.feedback}>작성한 문의가 없습니다.</p>
                    )}
                    {inquiries.map((inquiry) => (
                        <button
                            key={inquiry.inquiryId}
                            type="button"
                            className={styles.inquiryItem}
                            onClick={() => navigate(`/my/support/inquiries/${inquiry.inquiryId}`)}
                        >
                            <span className={styles.inquiryCopy}>
                                <strong>{inquiry.title}</strong>
                                <time>{formatDate(inquiry.createdAt)}</time>
                            </span>

                            <span
                                className={
                                    inquiry.status === 'answered'
                                        ? styles.statusAnswered
                                        : styles.statusWaiting
                                }
                            >
                                {inquiry.statusLabel}
                            </span>

                            <FiChevronRight size={18} aria-hidden="true" />
                        </button>
                    ))}
                </div>
            </section>
        </main>
    )
}

export default InquiriesPage
