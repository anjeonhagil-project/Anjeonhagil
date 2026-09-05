// 기능: M-AUTH-007 약관 동의 화면
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import { TERMS_CONTENT } from './termsContent.js'
import { agreeToTerms } from './api.js'
import styles from './TermsPage.module.css'

const TERM_KEYS = ['service', 'privacy', 'location']

function CheckIcon({ checked }) {
    return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <circle
                cx="11"
                cy="11"
                r="10"
                fill={checked ? 'var(--color-primary-500-main)' : 'none'}
                stroke={checked ? 'var(--color-primary-500-main)' : 'var(--color-border-gray)'}
                strokeWidth="1.6"
            />
            {checked && (
                <path
                    d="M6.5 11.2l3 3 6-6.4"
                    stroke="var(--color-text-white)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </svg>
    )
}

function ChevronIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M6.5 3.5l6 6-6 6" stroke="var(--color-text-sub)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function TermsPage() {
    const navigate = useNavigate()
    const [agreedItems, setAgreedItems] = useState({ service: false, privacy: false, location: false })
    const [showFailModal, setShowFailModal] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const allAgreed = TERM_KEYS.every((key) => agreedItems[key])

    const toggleAll = () => {
        const next = !allAgreed
        setAgreedItems({ service: next, privacy: next, location: next })
    }

    const toggleOne = (key) => {
        setAgreedItems((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const handleSubmit = async () => {
        if (submitting) return

        if (!allAgreed) {
            setShowFailModal(true)
            return
        }

        setSubmitting(true)
        try {
            await agreeToTerms()
            navigate('/location-permission', { replace: true })
        } catch {
            setSubmitting(false)
            setShowFailModal(true)
        }
    }

    return (
        <div>
            <Header title="약관 동의" onBack={() => window.history.back()} />
            <div className={styles.page}>
                <button type="button" className={styles.allCard} onClick={toggleAll}>
                    <CheckIcon checked={allAgreed} />
                    <div className={styles.allText}>
                        <p className={styles.allTitle}>전체 동의</p>
                        <p className={styles.allDescription}>안전하길 서비스 이용을 위해 모든 필수 약관에 동의합니다.</p>
                    </div>
                </button>

                <div className={styles.list}>
                    {TERM_KEYS.map((key) => (
                        <div key={key} className={styles.item}>
                            <button
                                type="button"
                                className={styles.itemCheck}
                                onClick={() => toggleOne(key)}
                                aria-label={`${TERMS_CONTENT[key].label} 동의`}
                            >
                                <CheckIcon checked={agreedItems[key]} />
                            </button>
                            <button type="button" className={styles.itemLabel} onClick={() => navigate(`/terms/${key}`)}>
                                <span>
                                    {TERMS_CONTENT[key].label} <span className={styles.required}>(필수)</span>
                                </span>
                                <ChevronIcon />
                            </button>
                        </div>
                    ))}
                </div>

                <Button fullWidth className={styles.submitBtn} onClick={handleSubmit}>
                    {submitting ? '처리 중...' : '동의하고 가입 완료'}
                </Button>
            </div>

            <Modal
                open={showFailModal}
                icon="warning"
                title="약관 동의 실패"
                description={'서비스 이용을 위해 필수 약관에\n동의해 주세요.'}
                confirmLabel="확인"
                onConfirm={() => setShowFailModal(false)}
            />
        </div>
    )
}

export default TermsPage
