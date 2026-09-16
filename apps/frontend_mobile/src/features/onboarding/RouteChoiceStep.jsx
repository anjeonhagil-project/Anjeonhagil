// 고정 4문항의 A/B/판단보류를 별도 설문 API에 저장하며 미응답은 완료로 처리하지 않는다.
import {useEffect,useState} from 'react'
import {apiClient} from '../../lib/apiClient.js'
import RouteMap from '../../components/map/RouteMap.jsx'
import {FeatureValues,distanceLabel,durationLabel} from '../routes/RouteCandidateCard.jsx'
import {BURDEN_FACTORS} from '../preferences/preferenceFields.js'
import '../routes/serviceRoutes.css'
export default function RouteChoiceStep({onComplete}) {
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
    const factor=BURDEN_FACTORS.find(f=>f.code===session?.reference_factor)
    if(!q)return <div className="service-content">{error?<p role="alert">{error}<button onClick={()=>setAttempt(v=>v+1)}>다시 시도</button></p>:<p role="status">비교 설문을 불러오고 있어요…</p>}</div>
    const routes=q.routes.map(r=>({...r,candidate_id:r.route_key}))
    return <div className="service-content">
        <p className="service-note">경로 비교 설문 {index+1} / 4</p>
        <div className="q4-progress"><span style={{width:((index+1)*25)+'%'}}/></div>
        <h2 className="q4-title">{q.dimension==='TIME'?'시간':'거리'} 차이가 {q.level==='SMALL'?'작은':'큰'} 경우,<br/>어느 길을 이용하고 싶나요?</h2>
        <p>{factor?.label} 부담이 다른 두 경로입니다. 전체 조건을 비교해주세요.</p>
        {session.reference_source==='DEFAULT_REFERENCE'&&<p className="service-note">부담 순위를 선택하지 않아 좁은 도로를 공통 비교 예시로 사용합니다. 내 선호 순위로 저장하지 않습니다.</p>}
        <RouteMap candidates={routes} selectedId={routes.find(r=>r.label===choice)?.candidate_id} onSelect={id=>setChoice(routes.find(r=>r.candidate_id===id).label)} origin={q.origin} destination={q.destination} height={220}/>
        <div className="q4-options">{routes.map(r=><button key={r.label} className={'q4-option'+(choice===r.label?' selected':'')} aria-pressed={choice===r.label} disabled={busy} onClick={()=>setChoice(r.label)}>
            <b>경로 {r.label}</b><strong>{durationLabel(r.display_duration_s)} · {distanceLabel(r.distance_m)}</strong><FeatureValues values={r.raw_features}/>
        </button>)}</div>
        <button className={'q4-unsure'+(choice==='UNSURE'?' selected':'')} aria-pressed={choice==='UNSURE'} disabled={busy} onClick={()=>setChoice('UNSURE')}>판단하기 어려워요</button>
        <p className="service-note">{q.notice} 시간은 과거 교통자료 기반 예상값입니다.</p>
        {error&&<p className="service-error" role="alert">{error}</p>}
        <button className="service-primary" disabled={!choice||busy} onClick={next}>{busy?'저장 중…':index===3?'설정 완료':'다음 문항'}</button>
        <p className="service-note">이 답변은 설문으로만 저장하며 현재 추천 가중치를 변경하거나 실제 이용 이력으로 사용하지 않습니다.</p>
    </div>
}
