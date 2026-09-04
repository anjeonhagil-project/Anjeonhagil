// 기능: M-AUTH-007 약관 상세 (서비스 이용약관 / 개인정보 처리방침 / 위치기반서비스 이용약관)
import { useParams } from 'react-router-dom'
import Header from '../../components/layout/Header.jsx'
import { TERMS_CONTENT } from './termsContent.js'
import styles from './TermsDetailPage.module.css'

function TermsDetailPage() {
    const { type } = useParams()
    const term = TERMS_CONTENT[type]

    if (!term) {
        return (
            <div>
                <Header title="약관" onBack={() => window.history.back()} />
                <div className={styles.page}>존재하지 않는 약관입니다.</div>
            </div>
        )
    }

    return (
        <div>
            <Header title={term.label} onBack={() => window.history.back()} />
            <div className={styles.page}>
                <p className={styles.body}>{term.body}</p>
            </div>
        </div>
    )
}

export default TermsDetailPage
