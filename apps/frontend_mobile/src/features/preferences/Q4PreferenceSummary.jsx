import {useEffect,useState} from 'react'
import {apiClient} from '../../lib/apiClient.js'
import {BURDEN_FACTORS} from './preferenceFields.js'
import styles from './Q4PreferenceSummary.module.css'
export default function Q4PreferenceSummary({value,ranks}){
    const [loaded,setLoaded]=useState(null),[error,setError]=useState('')
    useEffect(()=>{if(value!==undefined)return;let active=true;apiClient.get('/driving-preferences/personalization').then(r=>active&&setLoaded(r.q4)).catch(e=>active&&setError(e.message));return ()=>{active=false}},[value])
    const q4=value??loaded, top=BURDEN_FACTORS[ranks?.indexOf(1)]
    return <section className={styles.summary} data-testid="q4-summary">
        <h3 className={styles.title}>나의 운전 선호</h3>
        <span className={styles.label}>가장 부담되는 상황</span>
        <strong className={styles.factor}>{top?.label||'선택한 부담 없음'}</strong>
        {error&&<p role="alert">{error}</p>}
        {!q4&&!error&&<p role="status">설정한 선호를 불러오고 있어요…</p>}
        {q4&&<>
            <div className={styles.statuses}>
                <div><span className={styles.label}>경로 비교</span><span className={styles.badge}>{q4.pending?'작성 중':q4.status==='INCOMPLETE'?'미완료':'완료'}</span></div>
                <div><span className={styles.label}>추천 반영</span><span className={q4.enabled&&q4.applicable?styles.active:styles.badge}>{!q4.enabled?'꺼짐':q4.status==='INCOMPLETE'?'대기':q4.applicable?'사용 중':'보류'}</span></div>
            </div>
            <p className={styles.note}>{q4.pending&&q4.status!=='INCOMPLETE'?(q4.enabled&&q4.applicable?'이전 완료 답변 적용 · 새 답변 작성 중':'이전 답변 저장됨 · 새 답변 작성 중'):!q4.enabled?'답변은 보관하고 기본 추천을 사용해요.':q4.status==='INCOMPLETE'?'Q3에서 경로 비교를 완료해주세요.':q4.applicable?'평가가 비슷한 경로에서만 참고해요.':'현재는 기본 추천을 유지해요.'}</p>
        </>}
    </section>
}
