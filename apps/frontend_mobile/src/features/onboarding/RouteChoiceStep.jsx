// 고정 4문항의 A/B/판단보류를 별도 설문 API에 저장하며 미응답은 완료로 처리하지 않는다.
import {useEffect,useRef,useState} from 'react'
import {apiClient} from '../../lib/apiClient.js'
import RouteMap from '../../components/map/RouteMap.jsx'
import {burdenComparison,exactDuration,metricNumber} from '../preferences/q4Comparison.js'
import {BURDEN_FACTORS} from '../preferences/preferenceFields.js'
import '../routes/serviceRoutes.css'
import styles from './RouteChoiceStep.module.css'
const metricValue=(v,i)=>`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:i===1||i===2?1:0})} ${i===5?'m':i===1||i===2?'점수·m':'지표'}`
export default function RouteChoiceStep({onComplete,completionLabel='설정 완료',embedded=false,onBusyChange}) {
    const content=useRef(null)
    const [session,setSession]=useState(null),[index,setIndex]=useState(0),[choice,setChoice]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
    useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange])
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

            if(r.completed){
                window.dispatchEvent(new Event('anjeon:profile-updated'))
                onComplete()
                return
            }

            setChoice(null)
            setIndex(r.answered)

        } catch(e) {
            setError(e.message)
        } finally {
            setBusy(false)
        }
    }

    const q=session?.questions[index]
    useEffect(()=>{if(content.current){if(embedded)content.current.scrollIntoView({block:'start'});else content.current.scrollTop=0}},[q?.question_id,embedded])
    const factor=BURDEN_FACTORS.find(f=>f.code===session?.reference_factor)
    if(!q)return <div className="service-content">{error?<p role="alert">{error}<button type="button" onClick={()=>setAttempt(v=>v+1)}>다시 시도</button></p>:<p role="status">비교 설문을 불러오고 있어요…</p>}</div>
    const routes=q.routes.map(r=>({...r,candidate_id:r.route_key}))
    const factorIndex=BURDEN_FACTORS.findIndex(f=>f.code===session.reference_factor)
    const [a,b]=routes
    const timeGap=Math.abs(a.display_duration_s-b.display_duration_s)
    const distanceGap=Math.abs(Math.round(a.distance_m)-Math.round(b.distance_m))
    const comparison=burdenComparison(a.raw_features[factorIndex],b.raw_features[factorIndex])
    return <div ref={content} className={`service-content ${styles.step} ${embedded?styles.embedded:''}`} data-testid="q4-step">
        <p className="service-note">경로 비교 설문 {index+1} / 4</p>
        <div className={styles.progress} data-testid="q4-progress"><span className={styles['progressStep'+(index+1)]}/></div>
        <h2 className={styles.title} data-testid="q4-title">Q3. 경로 비교</h2>
        <p className={styles.intro}>어느 경로를 선택하시겠어요?</p>
        <p className={styles.intro}><b>{factor?.label}</b> 부담과 {q.dimension==='TIME'?'이동 시간':'이동 거리'}를 비교해주세요. 정답은 없어요.</p>
        {session.reference_source==='DEFAULT_REFERENCE'&&<p className="service-note">부담 순위를 선택하지 않아 좁은 도로를 공통 비교 예시로 사용합니다. 내 선호 순위로 저장하지 않습니다.</p>}
        <div className={styles.difference} aria-label="두 경로의 차이"><b>{timeGap?`경로 ${a.display_duration_s<b.display_duration_s?'A':'B'} · ${exactDuration(timeGap)} 빠름`:'예상 시간 같음'}</b><b>{distanceGap?`경로 ${a.distance_m<b.distance_m?'A':'B'} · ${distanceGap.toLocaleString()}m 짧음`:'거리 차이 1m 미만'}</b><span>{comparison.summary}</span></div>
        <div className={styles.options} data-testid="q4-options">{routes.map((r,i)=><button type="button" key={r.label} className={choice===r.label?`${styles.option} ${styles.selected}`:styles.option} data-testid="q4-option" aria-pressed={choice===r.label} disabled={busy} onClick={()=>setChoice(r.label)}>
            <span className={`${styles.cardHeading} ${styles['route'+r.label]}`}><b>경로 {r.label}</b><span aria-hidden="true">{choice===r.label?'✓':'○'}</span></span>
            <strong className={styles.time}>{exactDuration(r.display_duration_s)}</strong><span className={styles.distance}>{Math.round(r.distance_m).toLocaleString()} m</span>
            <span className={styles.focus} data-testid="q4-focus"><span>{factor?.label}</span><b>{metricNumber(r.raw_features[factorIndex])}<small>{factorIndex===5?' m':factorIndex===1||factorIndex===2?' 점수·m':' 지표'}</small></b><span className={styles.bar} aria-hidden="true"><span style={{width:comparison.widths[i]+'%',background:r.label==='A'?'#16858b':'#6b72c5'}}/></span></span>
        </button>)}</div>
        <p className={styles.unitNote}>막대는 두 경로의 같은 지표를 비교합니다. 감소율은 지표 차이이며, 사고 위험이나 체감 부담의 감소율은 아닙니다.</p>
        <button type="button" className={choice==='UNSURE'?`${styles.unsure} ${styles.selected}`:styles.unsure} aria-pressed={choice==='UNSURE'} disabled={busy} onClick={()=>setChoice('UNSURE')}>판단하기 어려워요</button>
        <p className="service-note">다른 도로 조건도 함께 달라집니다. 시간은 과거 교통자료 기반 예상값입니다.</p>
        <details className={styles.details} key={'map'+q.question_id}><summary>지도에서 비교하기</summary><RouteMap comparison candidates={routes} selectedId={routes.find(r=>r.label===choice)?.candidate_id} onSelect={id=>{if(!busy)setChoice(routes.find(r=>r.candidate_id===id).label)}} origin={q.origin} destination={q.destination} size="compact"/><div className={styles.mapLegend}><span>● 경로 A</span><span>┄ 경로 B</span></div></details>
        <details className={styles.details} data-testid="q4-details" key={q.question_id}><summary>부담 수치와 다른 도로 조건 비교하기</summary><table><caption>경로별 부담 지표 — 낮을수록 해당 요소가 적습니다</caption><thead><tr><th scope="col">비교 항목</th>{routes.map(r=><th scope="col" key={r.label}>경로 {r.label}</th>)}</tr></thead><tbody>{BURDEN_FACTORS.map((f,i)=><tr key={f.code}><th scope="row">{f.label}</th>{routes.map(r=><td key={r.label}>{metricValue(r.raw_features[i],i)}</td>)}</tr>)}</tbody></table><p className="service-note">지표는 계산한 부담값, 점수·m는 도로별 부담 점수 × 통과 거리입니다. 어린이 보호시설 주변 m는 시설 중심 100m 원 내부 통과 거리이며 법정 보호구역 전체를 뜻하지 않습니다.</p></details>
        {error&&<p className="service-error" role="alert">{error}</p>}
        <button type="button" className="service-primary" disabled={!choice||busy} onClick={next}>{busy?'저장 중…':index===3?completionLabel:'다음 문항'}</button>
        <p className="service-note">다음 문항으로 넘어가면 답변이 저장됩니다. 저장한 답변은 설문을 다시 시작해 변경할 수 있어요.</p>
        <p className="service-note">{session.q4AffectsRecommendation?'답변은 추천 평가가 비슷한 길을 고를 때 참고해요.':'답변을 저장하며 현재는 기본 추천 기준을 유지해요.'} 판단이 어려우면 보류해도 괜찮아요.</p>
    </div>
}
