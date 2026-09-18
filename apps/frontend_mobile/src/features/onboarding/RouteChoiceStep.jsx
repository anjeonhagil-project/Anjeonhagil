// 고정 4문항의 A/B/판단보류를 별도 설문 API에 저장하며 미응답은 완료로 처리하지 않는다.
import {useEffect,useRef,useState} from 'react'
import {apiClient} from '../../lib/apiClient.js'
import RouteMap from '../../components/map/RouteMap.jsx'
import {distanceLabel,durationLabel} from '../routes/RouteCandidateCard.jsx'
import {BURDEN_FACTORS} from '../preferences/preferenceFields.js'
import '../routes/serviceRoutes.css'
import styles from './RouteChoiceStep.module.css'
const metricValue=(v,i)=>`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:i===1||i===2?1:0})} ${i===5?'m':i===1||i===2?'점수·m':'지표'}`
export default function RouteChoiceStep({onComplete}) {
    const content=useRef(null)
    const [session,setSession]=useState(null),[index,setIndex]=useState(0),[choice,setChoice]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
    useEffect(()=>{
        let active=true;setError('')
        apiClient.get('/driving-preferences/q4').then(s=>{
            if(!active)return
            if(s.completed_at){onComplete();return}
            setSession(s);setIndex(s.questions.findIndex((_,i)=>!s.answers.some(a=>a.question_index===i)))
        }).catch(e=>active&&setError(e.message))
        return ()=>{active=false}
    },[attempt])
    async function next(){
        if(!choice||busy)return
        setBusy(true);setError('')
        try {
            const r=await apiClient.post('/driving-preferences/q4',{sessionId:session.session_id,questionIndex:index,answer:choice})
            if(r.completed){window.dispatchEvent(new Event('anjeon:profile-updated'));onComplete();return}
            setChoice(null);setIndex(r.answered)
        }catch(e){setError(e.message)}finally{setBusy(false)}
    }
    const q=session?.questions[index]
    useEffect(()=>{if(content.current)content.current.scrollTop=0},[q?.question_id])
    const factor=BURDEN_FACTORS.find(f=>f.code===session?.reference_factor)
    if(!q)return <div className="service-content">{error?<p role="alert">{error}<button onClick={()=>setAttempt(v=>v+1)}>다시 시도</button></p>:<p role="status">비교 설문을 불러오고 있어요…</p>}</div>
    const routes=q.routes.map(r=>({...r,candidate_id:r.route_key}))
    const factorIndex=BURDEN_FACTORS.findIndex(f=>f.code===session.reference_factor)
    const [a,b]=routes
    const timeGap=Math.abs(a.display_duration_s-b.display_duration_s)/60
    const distanceGap=Math.round(Math.abs(a.distance_m-b.distance_m))
    return <div ref={content} className={`service-content ${styles.step}`} data-testid="q4-step">
        <p className="service-note">경로 비교 설문 {index+1} / 4</p>
        <div className={styles.progress} data-testid="q4-progress"><span className={styles['progressStep'+(index+1)]}/></div>
        <h2 className={styles.title} data-testid="q4-title">어느 길을 이용하고 싶나요?</h2>
        <p className={styles.intro}><b>{factor?.label}</b> 부담과 {q.dimension==='TIME'?'이동 시간':'이동 거리'}를 비교해주세요. 정답은 없어요.</p>
        {session.reference_source==='DEFAULT_REFERENCE'&&<p className="service-note">부담 순위를 선택하지 않아 좁은 도로를 공통 비교 예시로 사용합니다. 내 선호 순위로 저장하지 않습니다.</p>}
        <RouteMap comparison candidates={routes} selectedId={routes.find(r=>r.label===choice)?.candidate_id} onSelect={id=>{if(!busy)setChoice(routes.find(r=>r.candidate_id===id).label)}} origin={q.origin} destination={q.destination} size="compact"/>
        <div className={styles.mapLegend}><span>● 경로 A</span><span>┄ 경로 B</span></div>
        <div className={styles.difference} aria-label="두 경로의 차이"><b>{q.dimension==='TIME'?`시간 차이 ${timeGap}분`:`거리 차이 ${distanceGap.toLocaleString()}m`}</b><span>부담 차이 {metricValue(Math.abs(a.raw_features[factorIndex]-b.raw_features[factorIndex]),factorIndex)}</span></div>
        <div className={styles.options} data-testid="q4-options">{routes.map(r=><button key={r.label} className={choice===r.label?`${styles.option} ${styles.selected}`:styles.option} data-testid="q4-option" aria-pressed={choice===r.label} disabled={busy} onClick={()=>setChoice(r.label)}>
            <span className={`${styles.cardHeading} ${styles['route'+r.label]}`}><b>경로 {r.label}</b><span aria-hidden="true">{choice===r.label?'✓':'○'}</span></span>
            <strong className={styles.time}>{durationLabel(r.display_duration_s)}</strong><span className={styles.distance}>{distanceLabel(r.distance_m)}</span>
            <span className={styles.focus} data-testid="q4-focus"><span>{factor?.label}</span><b>{metricValue(r.raw_features[factorIndex],factorIndex)}</b></span>
        </button>)}</div>
        <p className={styles.unitNote}>부담 수치는 낮을수록 해당 요소가 적습니다. {factorIndex===5?'시설 중심 100m 원 안을 지나는 거리이며, 법정 보호구역 전체를 뜻하지 않습니다.':factorIndex===1||factorIndex===2?'점수·m는 도로별 부담 점수에 통과 거리를 곱한 값입니다.':'지표는 경로에서 계산한 부담값이며 사고 확률이 아닙니다.'}</p>
        <button className={choice==='UNSURE'?`${styles.unsure} ${styles.selected}`:styles.unsure} aria-pressed={choice==='UNSURE'} disabled={busy} onClick={()=>setChoice('UNSURE')}>판단하기 어려워요</button>
        <p className="service-note">다른 도로 조건도 함께 달라집니다. 시간은 과거 교통자료 기반 예상값입니다.</p>
        <details className={styles.details} data-testid="q4-details" key={q.question_id}><summary>다른 도로 조건 비교하기</summary><table><caption>경로별 부담 지표</caption><thead><tr><th scope="col">비교 항목</th>{routes.map(r=><th scope="col" key={r.label}>경로 {r.label}</th>)}</tr></thead><tbody>{BURDEN_FACTORS.map((f,i)=>i!==factorIndex&&<tr key={f.code}><th scope="row">{f.label}</th>{routes.map(r=><td key={r.label}>{metricValue(r.raw_features[i],i)}</td>)}</tr>)}</tbody></table><p className="service-note">지표는 부담값, 점수·m는 부담 점수 × 통과 거리, m는 시설 중심 100m 원 내부 통과 거리입니다.</p></details>
        {error&&<p className="service-error" role="alert">{error}</p>}
        <button className="service-primary" disabled={!choice||busy} onClick={next}>{busy?'저장 중…':index===3?'설정 완료':'다음 문항'}</button>
        <p className="service-note">답변은 추천 평가가 비슷한 경로의 시간·거리 선호에 참고합니다. 판단 보류는 기본 기준을 유지하며 실제 이용 건수에는 포함하지 않습니다.</p>
    </div>
}
