import {useEffect,useState} from 'react'
import Button from '../../components/common/Button/Button.jsx'
import styles from './PreferenceRankForm.module.css'
import {BURDEN_FACTORS,DRIVING_FREQUENCY_OPTIONS,normalizePreferences,validatePreferences} from './preferenceFields.js'

export default function PreferenceRankForm({initialValue,onSubmit,submitLabel='설문 저장',disabled=false,children,onDirtyChange,hideSubmit=false,formId,showSubmit=true}){
    const [answers,setAnswers]=useState(()=>normalizePreferences(initialValue)),[error,setError]=useState('')
    useEffect(()=>{setAnswers(normalizePreferences(initialValue))},[initialValue])
    useEffect(()=>{onDirtyChange?.(JSON.stringify(answers)!==JSON.stringify(normalizePreferences(initialValue)))},[answers,initialValue,onDirtyChange])
    const ordered=answers.ranks.map((rank,index)=>({rank,index})).filter(v=>v.rank>0).sort((a,b)=>a.rank-b.rank).map(v=>v.index)
    function reorder(indices){setError('');setAnswers(current=>({...current,ranks:BURDEN_FACTORS.map((_,i)=>indices.includes(i)?indices.indexOf(i)+1:0)}))}
    async function submit(event){
        event.preventDefault()
        if(disabled)return
        const payload={...answers,ranks:answers.ranks.map(v=>v??0)}
        const message=validatePreferences(payload)
        if(message){setError(message);return}
        setError('');await onSubmit(payload)
    }
    return <form id={formId} className={styles.form} onSubmit={submit}>
        <section className={styles.section}>
            <span className={styles.eyebrow}>01 · 운전 경험</span>
            <h2>얼마나 자주 운전하시나요?</h2>
            <div className={styles.frequency} role="group" aria-label="운전 빈도">
                {DRIVING_FREQUENCY_OPTIONS.map(option=><button type="button" key={option.value} aria-pressed={answers.drivingFrequency===option.value} disabled={disabled} onClick={()=>{setError('');setAnswers(current=>({...current,drivingFrequency:option.value}))}}>{option.label}</button>)}
            </div>
        </section>
        <section className={styles.section}>
            <span className={styles.eyebrow}>02 · 부담되는 상황</span>
            <h2>가장 부담되는 것부터 골라주세요</h2>
            <p>부담되는 순서대로 누르고, 다시 누르면 해제돼요.</p>
            <div className={styles.rankChoices} role="group" aria-label="부담 순위 선택">
                {BURDEN_FACTORS.map((factor,index)=>{
                    const rank=ordered.indexOf(index)+1
                    return <button key={factor.code} type="button" aria-label={factor.label} aria-pressed={rank>0} aria-description={rank?`${rank}순위`:'상관없음'} data-rank={rank} disabled={disabled} onClick={()=>reorder(rank?ordered.filter(i=>i!==index):[...ordered,index])}><span className={styles.rank} aria-hidden="true">{rank||'＋'}</span><span className={styles.factor}>{factor.label}</span></button>
                })}
            </div>
            <p className={styles.note}>선택하지 않은 항목은 ‘상관없음’으로 저장돼요.</p>
            <button className={styles.reset} type="button" disabled={disabled||!ordered.length} onClick={()=>reorder([])}>순위 다시 정하기</button>
        </section>
        {children}
        {error&&<p className={styles.error} role="alert">{error}</p>}
        {!hideSubmit&&showSubmit&&<Button type="submit" fullWidth disabled={disabled}>{submitLabel}</Button>}
    </form>
}
