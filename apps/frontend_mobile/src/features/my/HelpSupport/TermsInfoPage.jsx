// 약관 및 개인 정보 화면

import { FiChevronRight } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import Header from '../../../components/layout/Header.jsx'
import { TERMS_CONTENT } from '../../auth/termsContent.js'
import styles from './TermsInfoPage.module.css'

const TERMS = [
    { key: 'service', label: '서비스 이용약관' },
    { key: 'privacy', label: '개인정보 처리방침' },
    { key: 'location', label: '위치기반서비스 이용약관' },
]

function TermsInfoPage() {
    const navigate = useNavigate()

    const handleTermClick = (key) => {
        navigate(`/terms/${key}`)
    }

    return (
        <main className={styles.page}>
            <Header title="약관 및 개인정보" onBack={() => navigate('/my/support')} />

            <section className={`${styles.content} hide-scrollbar`} aria-label="약관 및 개인정보 목록">
                <div className={styles.termList}>
                    {TERMS.map((term) => (
                        <button
                            key={term.key}
                            type="button"
                            className={styles.termItem}
                            onClick={() => handleTermClick(term.key)}
                        >
                            <strong>
                                {TERMS_CONTENT[term.key]?.label || term.label}
                            </strong>
                            <FiChevronRight size={18} aria-hidden="true" />
                        </button>
                    ))}
                </div>
            </section>
        </main>
    )
}

export default TermsInfoPage