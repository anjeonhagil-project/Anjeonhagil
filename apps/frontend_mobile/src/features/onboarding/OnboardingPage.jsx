// 기능(Anjeonhagil): Q1~Q3 공통 설문을 저장하고 Q4 경로 비교 단계와 완료 상태를 구분한다.
import { useEffect, useState } from 'react'
import { useNavigate,useSearchParams } from 'react-router-dom'
import RouteChoiceStep from './RouteChoiceStep.jsx'
import Q4PreferenceSummary from '../preferences/Q4PreferenceSummary.jsx'
import { FaCheck } from 'react-icons/fa6'
import Header from '../../components/layout/Header.jsx'
import Button from '../../components/common/Button/Button.jsx'
import PreferenceRankForm from '../preferences/PreferenceRankForm.jsx'
import { getDrivingPreferences, saveDrivingPreferences } from './api.js'
import styles from './OnboardingPage.module.css'

function OnboardingPage() {
    const navigate = useNavigate()
    const [params]=useSearchParams()
    const [screen, setScreen] = useState('intro')
    const [initialValue, setInitialValue] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')

    useEffect(() => {
        let mounted = true
        getDrivingPreferences()
            .then((result) => {
                if (!mounted) return
                setInitialValue(result.preferences)
                if(params.get('q4')==='true'&&result.onboarding?.surveyCompleted)setScreen('route-choice-ready')
                else if (result.onboarding?.routeChoicesCompleted) setScreen('complete')
                else if (result.onboarding?.surveyCompleted) setScreen('route-choice-ready')
            })
            .catch((error) => mounted && setSubmitError(error.message || '설문 상태를 불러오지 못했습니다.'))
            .finally(() => mounted && setIsLoading(false))
        return () => { mounted = false }
    }, [])

    const saveSurvey = async (answers) => {
        if (isSubmitting) return
        setIsSubmitting(true)
        setSubmitError('')
        try {
            const result = await saveDrivingPreferences(answers)
            setInitialValue(result.preferences)
            setScreen(result.onboarding?.routeChoicesCompleted ? 'complete' : 'route-choice-ready')
        } catch (error) {
            setSubmitError(error.message || '설문 저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (screen === 'intro') {
        return (
            <main className={styles.page}>
                <Header title="운전 부담 설문" onBack={() => navigate(-1)} />
                <div className={`${styles.body} hide-scrollbar`}>
                    <section className={styles.introContent} aria-labelledby="onboarding-intro-title">
                        <div className={styles.roadIllustration} aria-hidden="true"><span className={styles.car}>🚙</span></div>
                        <span className={styles.introBadge}>내게 편한 길</span>
                        <h2 id="onboarding-intro-title" className={styles.introTitle}>나에게 맞는<br />편안한 길을 찾아볼까요?</h2>
                        <p className={styles.introDescription}>운전 빈도와 부담되는 상황을 알려주시면<br />나에게 맞는 길을 비교해드려요.</p>
                    </section>
                    {submitError && <p className={styles.errorMessage} role="alert">{submitError}</p>}
                    <div className={styles.bottomAction}>
                        <p className={styles.helperText}>답변은 언제든지 내 정보에서 바꿀 수 있어요.</p>
                        <Button fullWidth disabled={isLoading} onClick={() => setScreen('survey')}>시작하기</Button>
                    </div>
                </div>
            </main>
        )
    }

    if (screen === 'complete') {
        return (
            <main className={styles.page}>
                <Header title="설정 완료" onBack={() => navigate('/home')} />
                <div className={`${styles.body} hide-scrollbar`}>
                    <section className={styles.completeContent}>
                        <div className={styles.completeIcon}><FaCheck /></div>
                        <h2 className={styles.completeTitle}>나의 운전 부담 설정이 완료됐어요</h2>
                        <Q4PreferenceSummary ranks={initialValue?.ranks}/>
                    </section>
                    <div className={styles.bottomAction}><Button fullWidth onClick={() => navigate('/home', { replace: true })}>안전하길 시작하기</Button></div>
                </div>
            </main>
        )
    }

    if (screen === 'route-choice-ready') {
        return (
            <main className={styles.page}>
                <Header title="운전 부담 설문" onBack={() => setScreen('survey')} />
                <RouteChoiceStep onComplete={() => setScreen('complete')} />
            </main>
        )
    }

    return (
        <main className={styles.page}>
            <Header title="운전 부담 설문" onBack={() => setScreen('intro')} />
            <div className={`${styles.body} hide-scrollbar`}>
                <section className={styles.questionContent}>
                    <PreferenceRankForm formId="onboarding-preference-form" showSubmit={false} initialValue={initialValue} onSubmit={saveSurvey} disabled={isSubmitting} />
                    {submitError && <p className={styles.errorMessage} role="alert">{submitError}</p>}
                </section>
            </div>
            <div className={styles.fixedAction}>
                <Button type="submit" form="onboarding-preference-form" fullWidth disabled={isSubmitting}>{isSubmitting ? '저장 중...' : '다음'}</Button>
            </div>
        </main>
    )
}

export default OnboardingPage
