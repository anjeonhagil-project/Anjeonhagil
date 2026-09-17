import {useEffect,useState} from 'react'
import {apiClient} from '../../lib/apiClient.js'
import {BURDEN_FACTORS} from '../preferences/preferenceFields.js'
import {distanceLabel} from './RouteCandidateCard.jsx'
export default function BurdenTimeline({candidate,onFocus}) {
 const [factor,setFactor]=useState('all'),[limit,setLimit]=useState(20)
 const [open,setOpen]=useState(false),[explanation,setExplanation]=useState(candidate?.burden_explanation??null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
 useEffect(()=>{
  if(!open||explanation)return
  let active=true;setError('')
  apiClient.get(`/routes/searches/${candidate.search_id}/candidates/${candidate.candidate_id}/burden`).then(r=>{if(active)setExplanation(r)}).catch(e=>{if(active)setError(e.message)})
  return ()=>{active=false}
 },[open,explanation,candidate.search_id,candidate.candidate_id,attempt])
 const events=explanation?.events.filter(e=>factor==='all'||e.factor_index===Number(factor))??[]
 return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>부담 구간 미리보기 {explanation?`(${events.length}개)`:''}</summary>
 {error?<p role="alert">{error} <button onClick={()=>setAttempt(v=>v+1)}>설명 다시 불러오기</button></p>:!explanation?<p role="status">선택한 경로의 부담 구간을 계산하고 있어요…</p>:<><p className="service-note">{explanation.notice}</p>
 <label>부담 항목 <select value={factor} onChange={e=>{setFactor(e.target.value);setLimit(20)}}><option value="all">전체</option>{BURDEN_FACTORS.map((f,i)=><option key={f.code} value={i}>{f.label}</option>)}</select></label>
 <ol className="burden-timeline">{events.slice(0,limit).map((e,i)=><li key={i}><button type="button" onClick={()=>onFocus?.(e)}>{distanceLabel(e.start_m)} 지점{e.end_m>e.start_m?` ~ ${distanceLabel(e.end_m)}`:''} · {BURDEN_FACTORS[e.factor_index].label}{e.estimated?' (추정 지표)':''}</button>{e.previous_action_m!==null&&<small>앞선 동작과 약 {Math.round(e.start_m-e.previous_action_m)}m 간격</small>}</li>)}</ol>
 {!events.length&&<p>이 경로에서 해당 부담 지표가 계산된 구간이 없습니다.</p>}{events.length>limit&&<button type="button" onClick={()=>setLimit(v=>v+20)}>구간 더 보기</button>}
 </>}</details>
}
