import {useEffect,useState} from 'react'
import Button from '../../components/common/Button/Button.jsx'
import styles from './PreferenceRankForm.module.css'
import {BURDEN_FACTORS,DRIVING_FREQUENCY_OPTIONS,normalizePreferences,validatePreferences} from './preferenceFields.js'

export default function PreferenceRankForm({initialValue,onSubmit,submitLabel='설문 저장',disabled=false,children,onDirtyChange,hideSubmit=false}){
    const [answers,setAnswers]=useState(()=>normalizePreferences(initialValue)),[error,setError]=useState('')
    useEffect(()=>{setAnswers(normalizePreferences(initialValue))},[initialValue])
    useEffect(()=>{onDirtyChange?.(JSON.stringify(answers)!==JSON.stringify(normalizePreferences(initialValue)))},[answers,initialValue,onDirtyChange])
    const ordered=answers.ranks.map((rank,index)=>({rank,index})).filter(v=>v.rank>0).sort((a,b)=>a.rank-b.rank).map(v=>v.index)
    function reorder(indices){setError('');setAnswers(current=>({...current,ranks:BURDEN_FACTORS.map((_,i)=>indices.includes(i)?indices.indexOf(i)+1:0)}))}
    function move(position,delta){const next=[...ordered];[next[position],next[position+delta]]=[next[position+delta],next[position]];reorder(next)}
    async function submit(event){
        event.preventDefault()
        if(disabled)return
        const payload={...answers,ranks:answers.ranks.map(v=>v??0)}
        const message=validatePreferences(payload)
        if(message){setError(message);return}
        setError('');await onSubmit(payload)
    }
    return <form className={styles.form} onSubmit={submit}>
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
            <p>누르는 순서대로 순위가 정해져요. 화살표로 바꿀 수 있어요.</p>
            <ol className={styles.ranking} aria-label="선택한 부담 순위">
                {ordered.map((index,position)=><li key={BURDEN_FACTORS[index].code}>
                    <span className={styles.rank}>{position+1}</span><span className={styles.factor}>{BURDEN_FACTORS[index].label}</span>
                    <div className={styles.controls}>
                        <button type="button" aria-label={BURDEN_FACTORS[index].label+' 순위 올리기'} disabled={disabled||position===0} onClick={()=>move(position,-1)}>↑</button>
                        <button type="button" aria-label={BURDEN_FACTORS[index].label+' 순위 내리기'} disabled={disabled||position===ordered.length-1} onClick={()=>move(position,1)}>↓</button>
                        <button type="button" aria-label={BURDEN_FACTORS[index].label+' 선택 해제'} disabled={disabled} onClick={()=>reorder(ordered.filter(i=>i!==index))}>×</button>
                    </div>
                </li>)}
            </ol>
            {!ordered.length&&<p className={styles.empty}>아래에서 부담되는 상황을 선택해주세요.</p>}
            <div className={styles.available} aria-label="추가할 부담 상황">
                {BURDEN_FACTORS.map((factor,index)=>!ordered.includes(index)&&<button key={factor.code} type="button" disabled={disabled} onClick={()=>reorder([...ordered,index])}><span aria-hidden="true">＋</span> {factor.label}</button>)}
            </div>
            <p className={styles.note}>선택하지 않은 항목은 ‘상관없음’으로 저장돼요.</p>
        </section>
        {children}
        {error&&<p className={styles.error} role="alert">{error}</p>}
        {!hideSubmit&&<Button type="submit" fullWidth disabled={disabled}>{submitLabel}</Button>}
    </form>
}