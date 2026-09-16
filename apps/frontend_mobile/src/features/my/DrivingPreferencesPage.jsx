// 기능(Anjeonhagil): 최신 Q1~Q3 설문을 조회하고 새 설문·프로필 버전으로 저장한다.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/layout/Header.jsx'
import PreferenceRankForm from '../preferences/PreferenceRankForm.jsx'
import { getDrivingPreferences, updateDrivingPreferences } from './api.js'
import styles from './DrivingPreferencesPage.module.css'

function DrivingPreferencesPage() {
    const navigate = useNavigate()
    const [initialValue, setInitialValue] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        let mounted = true
        getDrivingPreferences()
            .then((result) => mounted && setInitialValue(result.preferences))
            .catch((requestError) => mounted && setError(requestError.message || '설문 답변을 불러오지 못했습니다.'))
            .finally(() => mounted && setIsLoading(false))
        return () => { mounted = false }
    }, [])

    const save = async (answers) => {
        setIsSubmitting(true)
        setError('')
        setMessage('')
        try {
            const result = await updateDrivingPreferences(answers)
            setInitialValue(result.preferences)
            setMessage('운전 부담 설정을 저장했습니다. 다음 경로 검색부터 새 설정을 적용합니다.')
        } catch (requestError) {
            setError(requestError.message || '설문 저장에 실패했습니다.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className={styles.page}>
            <Header title="운전 부담 설문" onBack={() => navigate('/my')} />
            <section className={`${styles.content} hide-scrollbar`}>
                <p className={styles.description}>운전 시 부담되는 상황을 알려주시면 맞춤 안전경로를 제안해 드려요.</p>
                {error && <p role="alert">{error}</p>}
                {message && <p role="status">{message}</p>}
                {!isLoading && <PreferenceRankForm initialValue={initialValue} onSubmit={save} disabled={isSubmitting} submitLabel={isSubmitting ? '저장 중...' : '변경 사항 저장'} />}
            </section>
        </main>
    )
}

export default DrivingPreferencesPage
