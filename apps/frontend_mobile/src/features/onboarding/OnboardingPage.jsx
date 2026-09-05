// 기능: M-ONB 온보딩 설문 시작/4문항/완료 화면
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiShield } from 'react-icons/fi'
import { FaCheck } from 'react-icons/fa6'
import Header from '../../components/layout/Header.jsx'
import Button from '../../components/common/Button/Button.jsx'
import { saveDrivingPreferences } from './api.js'
import styles from './OnboardingPage.module.css'

const QUESTIONS = [
    { key: 'intersectionScore', title: '차로 구조가 복잡한 교차로가 부담스러운가요?' },
    { key: 'pedestrianZoneScore', title: '어린이 보호구역이 부담스러운가요?' },
    { key: 'narrowRoadScore', title: '차량과 보행자가 함께 다니는 좁은 도로나 골목길이 부담스러운가요?' },
    { key: 'turnConflictScore', title: '좌회전·유턴 구간이 부담스러운가요?' },
]

const SCORE_OPTIONS = [
    { value: 1, label: '전혀 부담되지 않음' },
    { value: 2, label: '부담되지 않음' },
    { value: 3, label: '보통' },
    { value: 4, label: '조금 부담됨' },
    { value: 5, label: '많이 부담됨' },
]

// M-ONB-001, M-ONB-002-01~04, M-ONB-003 화면 상태를 한 컴포넌트에서 전환
function OnboardingPage() {
    const navigate = useNavigate()
    const [screen, setScreen] = useState('intro')
    const [questionIndex, setQuestionIndex] = useState(0)
    const [answers, setAnswers] = useState({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')

    const question = QUESTIONS[questionIndex]
    const selectedScore = question ? answers[question.key] : null

    const selectScore = (score) => {
        setSubmitError('')
        setAnswers((current) => ({ ...current, [question.key]: score }))
    }

    const goPrevious = () => {
        setSubmitError('')

        if (questionIndex === 0) {
            setScreen('intro')
            return
        }

        setQuestionIndex((current) => current - 1)
    }

    const goNext = async () => {
        if (!selectedScore || isSubmitting) return

        const isLastQuestion = questionIndex === QUESTIONS.length - 1
        if (!isLastQuestion) {
            setQuestionIndex((current) => current + 1)
            return
        }

        setIsSubmitting(true)
        setSubmitError('')

        try {
            await saveDrivingPreferences(answers)
            setScreen('complete')
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
                <div className={styles.body}>
                <section className={styles.introContent} aria-labelledby="onboarding-intro-title">
                    <div className={styles.roadIllustration} aria-hidden="true">
                        <span className={styles.cloudOne} />
                        <span className={styles.cloudTwo} />
                        <span className={styles.sparkleOne}>✦</span>
                        <span className={styles.sparkleTwo}>✦</span>
                        <span className={styles.car}>🚙</span>
                        <span className={styles.roadLine} />
                    </div>
                    <span className={styles.introBadge}>내게 꼭 맞는 안전경로</span>
                    <h2 id="onboarding-intro-title" className={styles.introTitle}>
                        나에게 맞는<br />
                        편안한 길을 찾아볼까요?
                    </h2>
                    <p className={styles.introDescription}>
                        운전할 때 부담스러운 상황을 알려주시면<br />
                        나에게 맞는 안전한 길을 추천해드려요.
                    </p>
                </section>
                <div className={styles.bottomAction}>
                    <p className={styles.helperText}>답변은 언제든지 내 정보에서 바꿀 수 있어요.</p>
                    <Button fullWidth onClick={() => setScreen('questions')}>시작하기</Button>
                </div>
                </div>
            </main>
        )
    }

    if (screen === 'complete') {
        return (
            <main className={styles.page}>
                <Header title="설정 완료" onBack={() => navigate('/home')} />
                <div className={styles.body}>
                <section className={styles.completeContent} aria-labelledby="onboarding-complete-title">
                    <div className={styles.completeIconWrap} aria-hidden="true">
                        <span className={styles.completeDotPink} />
                        <span className={styles.completeDotGold} />
                        <div className={styles.completeIcon}>
                            <FaCheck />
                        </div>
                    </div>
                    <h2 id="onboarding-complete-title" className={styles.completeTitle}>
                        나의 운전 부담 설정이 완료됐어요
                    </h2>
                    <div className={styles.completeNotice}>
                        <div className={styles.completeNoticeHeader}>
                            <FiShield aria-hidden="true" />
                            <span>초보 드라이버 맞춤 경로 가이드</span>
                        </div>
                        <p>• 도로 분위기에 맞는 경로를 찾아드려요.</p>
                        <p>• 복잡한 교차로를 최대한 피해드려요.</p>
                        <p>• 터치 한 번으로 편안한 길을 안내해요.</p>
                    </div>
                </section>
                <div className={styles.bottomAction}>
                    <Button fullWidth onClick={() => navigate('/home', { replace: true })}>
                        안전하길 시작하기
                    </Button>
                </div>
                </div>
            </main>
        )
    }

    return (
        <main className={styles.page}>
            <Header title="운전 부담 설문" onBack={goPrevious} />
            <div className={styles.body}>
            <section className={styles.questionContent} aria-labelledby="onboarding-question-title">
                <div className={styles.progressHeader}>
                    <span>운전할 때 부담되는 상황을 알려주세요</span>
                    <strong>진행 {questionIndex + 1}/4</strong>
                </div>
                <div className={styles.progressTrack} aria-hidden="true">
                    <span style={{ width: `${((questionIndex + 1) / QUESTIONS.length) * 100}%` }} />
                </div>

                <h2 id="onboarding-question-title" className={styles.questionTitle}>
                    Q{questionIndex + 1}. {question.title}
                </h2>

                <fieldset className={styles.options}>
                    <legend className={styles.srOnly}>부담 정도 선택</legend>
                    {SCORE_OPTIONS.map((option) => {
                        const isSelected = selectedScore === option.value

                        return (
                            <label
                                key={option.value}
                                className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                            >
                                <input
                                    type="radio"
                                    name={question.key}
                                    value={option.value}
                                    checked={isSelected}
                                    onChange={() => selectScore(option.value)}
                                />
                                <span className={styles.radioMark} aria-hidden="true" />
                                <span>{option.label}</span>
                            </label>
                        )
                    })}
                </fieldset>

                {submitError && <p className={styles.errorMessage} role="alert">{submitError}</p>}
            </section>
            <div className={styles.questionActions}>
                <Button variant="secondary" fullWidth onClick={goPrevious} disabled={isSubmitting}>
                    이전
                </Button>
                <Button fullWidth onClick={goNext} disabled={!selectedScore || isSubmitting}>
                    {isSubmitting ? '저장 중...' : '다음'}
                </Button>
            </div>
            </div>
        </main>
    )
}

export default OnboardingPage
