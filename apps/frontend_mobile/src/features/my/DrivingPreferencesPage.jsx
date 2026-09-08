import { useState, useEffect } from 'react'
// import { FiChevronRight } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/layout/Header.jsx'
import Button from '../../components/common/Button/Button.jsx'
import styles from './DrivingPreferencesPage.module.css'
import { getDrivingPreferences, updateDrivingPreferences } from './api.js'
import { Modal } from '../../components/common/index.js'

const QUESTIONS = [
    {
        key: 'intersectionScore',
        number: 1,
        title: '신호가 없거나 차로 구조가 복잡한 교차로가 부담스러운가요?',
    },
    {
        key: 'pedestrianZoneScore',
        number: 2,
        title: '보행자, 어린이 보호구역이 부담스러운가요?',
    },
    {
        key: 'narrowRoadScore',
        number: 3,
        title: '차량과 보행자가 함께 다니는 좁은 도로나 골목길이 부담스러운가요?',
    },
    {
        key: 'turnConflictScore',
        number: 4,
        title: '반대편 차량을 확인해야 하는 좌회전·유턴 구간이 부담스러운가요?',
    },
]

const SCORE_LABELS = {
    1: '전혀 부담되지 않음',
    2: '부담되지 않음',
    3: '보통',
    4: '조금 부담됨',
    5: '많이 부담됨',
}

const SCORE_OPTIONS = [
    { value: 1, label: '전혀 부담되지 않음' },
    { value: 2, label: '부담되지 않음' },
    { value: 3, label: '보통' },
    { value: 4, label: '조금 부담됨' },
    { value: 5, label: '많이 부담됨' },
]

function DrivingPreferencesPage() {
    const navigate = useNavigate()
    const [answers, setAnswers] = useState({})
    const [initialAnswers, setInitialAnswers] = useState({})
    // const [openQuestionKey, setOpenQuestionKey] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [saveError, setSaveError] = useState('')

    useEffect(() => {
        let isMounted = true

        const loadPreferences = async () => {
            try {
                const preferences = await getDrivingPreferences()

                if (isMounted && preferences) {
                    const loadedAnswers = {
                        intersectionScore: preferences.intersectionScore,
                        pedestrianZoneScore: preferences.pedestrianZoneScore,
                        narrowRoadScore: preferences.narrowRoadScore,
                        turnConflictScore: preferences.turnConflictScore,
                    }

                    setAnswers(loadedAnswers)
                    setInitialAnswers(loadedAnswers)
                }
            } catch (error) {
                if (isMounted) {
                    setLoadError(
                        error.message ||
                        '설문 답변을 불러오지 못했습니다. 다시 시도해주세요.'
                    )
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        loadPreferences()

        return () => {
            isMounted = false
        }
    }, [])

    const hasChanges = QUESTIONS.some(
        (question) =>
            answers[question.key] !== initialAnswers[question.key]
    )

    // const handleSelectAnswer = (questionKey, score) => {
    //     setAnswers((current) => ({
    //         ...current,
    //         [questionKey]: score,
    //     }))
    //     setOpenQuestionKey(null)
    // }

    const handleOpenSaveModal = () => {
        if (!hasChanges || isSubmitting) return

        setSaveError('')
        setIsSaveConfirmOpen(true)
    }

    const handleConfirmSave = async () => {
        if (isSubmitting) return

        setIsSubmitting(true)
        setSaveError('')

        try {
            await updateDrivingPreferences(answers)

            setInitialAnswers({ ...answers })
            setIsSaveConfirmOpen(false)
            navigate('/my')
        } catch (error) {
            setIsSaveConfirmOpen(false)
            setSaveError(
                error.message ||
                '설문 저장에 실패했습니다. 다시 시도해주세요.'
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className={styles.page}>
            <Header
                title="운전 부담 설문"
                onBack={() => navigate('/my')}
            />

            <section className={styles.content}>
                <p className={styles.description}>
                    운전 시 부담되는 상황을 알려주시면 맞춤 안전경로를
                    제안해 드려요.
                </p>

                <div className={styles.questionList}>
                    {loadError && (
                        <p role="alert">{loadError}</p>
                    )}
                    {QUESTIONS.map((question) => (
                        <article
                            key={question.key}
                            className={styles.questionCard}
                        >
                            <h2>
                                <span>{question.number}</span>
                                {question.title}
                            </h2>

                            <select
                                className={styles.select}
                                value={answers[question.key] ?? ''}
                                disabled={isLoading}
                                onChange={(event) => {
                                    setAnswers((current) => ({
                                        ...current,
                                        [question.key]: Number(event.target.value),
                                    }))
                                }}
                            >
                                <option value="" disabled>
                                    선택해주세요
                                </option>

                                {SCORE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </article>
                    ))}
                </div>
            </section>
            
            <div className={styles.saveArea}>
                {saveError && (
                    <p role="alert">{saveError}</p>
                )}

                <Button
                    fullWidth
                    disabled={isLoading || !hasChanges || isSubmitting}
                    onClick={handleOpenSaveModal}
                >
                    변경 사항 저장
                </Button>
            </div>

            <Modal
                open={isSaveConfirmOpen}
                icon="edit"
                title="설문 변경"
                description="운전 부담 설문을 변경하시겠습니까?"
                cancelLabel="취소"
                onCancel={() => setIsSaveConfirmOpen(false)}
                confirmLabel={isSubmitting ? '저장 중...' : '변경'}
                onConfirm={handleConfirmSave}
            />
        </main>
    )
}

export default DrivingPreferencesPage