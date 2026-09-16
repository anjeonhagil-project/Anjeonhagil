// 기능(Anjeonhagil): 온보딩·마이페이지 공통 Q1 운전빈도·Q2 부담순위·Q3 허용시간 폼이다.
import { useEffect, useState } from 'react'
import Button from '../../components/common/Button/Button.jsx'
import styles from './PreferenceRankForm.module.css'
import {
    BURDEN_FACTORS,
    DETOUR_OPTIONS,
    DRIVING_FREQUENCY_OPTIONS,
    normalizePreferences,
    validatePreferences,
} from './preferenceFields.js'

function PreferenceRankForm({ initialValue, onSubmit, submitLabel = '설문 저장', disabled = false }) {
    const [answers, setAnswers] = useState(() => normalizePreferences(initialValue))
    const [error, setError] = useState('')

    useEffect(() => {
        setAnswers(normalizePreferences(initialValue))
    }, [initialValue])

    const updateRank = (index, rawValue) => {
        const rank = Number(rawValue)
        setError('')
        setAnswers((current) => ({
            ...current,
            ranks: current.ranks.map((value, rankIndex) => rankIndex === index ? rank : value),
        }))
    }

    const submit = async (event) => {
        event.preventDefault()
        const validationError = validatePreferences(answers)
        if (validationError) {
            setError(validationError)
            return
        }
        setError('')
        await onSubmit(answers)
    }

    return (
        <form className={styles.form} onSubmit={submit}>
            <section className={styles.section}>
                <h2>Q1. 평소 얼마나 자주 운전하시나요?</h2>
                <select
                    aria-label="운전 빈도"
                    value={answers.drivingFrequency}
                    disabled={disabled}
                    onChange={(event) => setAnswers((current) => ({ ...current, drivingFrequency: event.target.value }))}
                >
                    <option value="" disabled>선택해주세요</option>
                    {DRIVING_FREQUENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </section>

            <section className={styles.section}>
                <h2>Q2. 부담되는 상황의 순위를 정해주세요.</h2>
                <p>부담되지 않는 항목은 ‘상관없음’을 선택하세요. 나머지는 1순위부터 연속으로 선택합니다.</p>
                {BURDEN_FACTORS.map((factor, index) => (
                    <label key={factor.code} className={styles.rankRow}>
                        <span>{factor.label}</span>
                        <select
                            aria-label={`${factor.label} 부담 순위`}
                            value={answers.ranks[index] ?? ''}
                            disabled={disabled}
                            onChange={(event) => updateRank(index, event.target.value)}
                        >
                            <option value="" disabled>선택</option>
                            <option value="0">상관없음</option>
                            {BURDEN_FACTORS.map((_, rankIndex) => (
                                <option key={rankIndex + 1} value={rankIndex + 1}>{rankIndex + 1}순위</option>
                            ))}
                        </select>
                    </label>
                ))}
            </section>

            <section className={styles.section}>
                <h2>Q3. 더 안전한 길이라면 시간을 얼마나 더 쓸 수 있나요?</h2>
                <select
                    aria-label="우회 허용시간"
                    value={answers.maxDetourMinutes === undefined ? '' : answers.maxDetourMinutes === null ? 'flexible' : String(answers.maxDetourMinutes)}
                    disabled={disabled}
                    onChange={(event) => {
                        const option = DETOUR_OPTIONS.find((item) => item.value === event.target.value)
                        setAnswers((current) => ({ ...current, maxDetourMinutes: option?.minutes }))
                    }}
                >
                    <option value="" disabled>선택해주세요</option>
                    {DETOUR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </section>

            {error && <p className={styles.error} role="alert">{error}</p>}
            <Button type="submit" fullWidth disabled={disabled}>{submitLabel}</Button>
        </form>
    )
}

export default PreferenceRankForm
