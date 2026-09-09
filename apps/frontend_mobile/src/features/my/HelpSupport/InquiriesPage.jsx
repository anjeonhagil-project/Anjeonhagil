import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FiChevronRight } from 'react-icons/fi'
import Button from '../../../components/common/Button/Button.jsx'
import Header from '../../../components/layout/Header.jsx'
import styles from './InquiriesPage.module.css'

const INITIAL_INQUIRIES = [
    {
        id: 1,
        title: '경로 안내 중 앱이 종료됩니다',
        date: '2025.01.12',
        status: '답변 완료',
    },
    {
        id: 2,
        title: '안심경로와 일반 경로의 차이점입니다',
        date: '2025.01.08',
        status: '답변 대기',
    },
    {
        id: 3,
        title: '즐겨찾기가 사라졌습니다',
        date: '2024.12.18',
        status: '답변 완료',
    },
    {
        id: 4,
        title: '즐겨찾기가 사라졌습니다',
        date: '2024.12.18',
        status: '답변 완료',
    },
    {
        id: 5,
        title: '즐겨찾기가 사라졌습니다',
        date: '2024.12.18',
        status: '답변 완료',
    },
    {
        id: 6,
        title: '즐겨찾기가 사라졌습니다',
        date: '2024.12.18',
        status: '답변 완료',
    },
    {
        id: 7,
        title: '즐겨찾기가 사라졌습니다',
        date: '2024.12.18',
        status: '답변 완료',
    },
    {
        id: 8,
        title: '즐겨찾기가 사라졌습니다',
        date: '2024.12.18',
        status: '답변 완료',
    },
    {
        id: 9,
        title: '즐겨찾기가 사라졌습니다',
        date: '2024.12.18',
        status: '답변 완료',
    },
    {
        id: 10,
        title: '즐겨찾기가 사라졌습니다',
        date: '2024.12.18',
        status: '답변 완료',
    },
    {
        id: 11,
        title: '즐겨찾기가 사라졌습니다',
        date: '2024.12.18',
        status: '답변 완료',
    },
]

function InquiriesPage() {
    const navigate = useNavigate()
    const location = useLocation()

    const [inquiries] = useState(() => {
        const createdInquiry = location.state?.createdInquiry

        if (!createdInquiry) return INITIAL_INQUIRIES

        return [createdInquiry, ...INITIAL_INQUIRIES]
    })

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
                    {inquiries.map((inquiry) => (
                        <button
                            key={inquiry.id}
                            type="button"
                            className={styles.inquiryItem}
                        >
                            <span className={styles.inquiryCopy}>
                                <strong>{inquiry.title}</strong>
                                <time>{inquiry.date}</time>
                            </span>

                            <span
                                className={
                                    inquiry.status === '답변 완료'
                                        ? styles.statusAnswered
                                        : styles.statusWaiting
                                }
                            >
                                {inquiry.status}
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