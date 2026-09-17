// 사용자가 행동 보정을 끄거나 이력 반영 시작점을 초기화할 수 있다. 원본 선택 로그는 삭제하지 않는다.
import {useEffect,useState} from 'react'
import {apiClient} from '../../lib/apiClient.js'
import {BURDEN_FACTORS} from '../preferences/preferenceFields.js'
import Q4PreferenceSummary from '../preferences/Q4PreferenceSummary.jsx'
import {useNavigate} from 'react-router-dom'
import '../routes/serviceRoutes.css'
const reasons={INSUFFICIENT_ACTUAL_CHOICES:'실제 경로 선택 이력이 아직 부족합니다.',AT_LEAST_TWO_PREFERENCES_REQUIRED:'부담 항목을 두 개 이상 선택하면 보정할 수 있습니다.',NO_VALID_IMPROVEMENT:'최근 검증에서 개선이 없어 현재 설정을 유지합니다.',VALIDATION_IMPROVED:'최근 검증에서 개선된 가중치를 적용했습니다.',STALE_PROFILE_OR_MODEL_OR_DISABLED:'설정 변경을 감지해 이전 갱신을 보류했습니다.'}
export default function PersonalizationSettings(){
    Object.assign(reasons,{NO_PREFERENCE_VARIATION:'비교한 경로에서 선호를 구분할 부담 차이가 부족합니다.',INSUFFICIENT_VALIDATION_CHOICES:'보정과 검증에 나누어 쓸 선택 이력이 부족합니다.',INSUFFICIENT_VALIDATION_VARIATION:'최근 검증 경로의 부담 차이가 부족해 현재 설정을 유지합니다.'})
    const navigate=useNavigate(),[confirmRestart,setConfirmRestart]=useState(false)
    const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
    useEffect(()=>{apiClient.get('/driving-preferences/personalization').then(setState).catch(e=>setError(e.message))},[])
    async function change(enabled){
        setBusy(true);setError('')
        try{setState(await apiClient.post('/driving-preferences/personalization/reset',{enabled}))}catch(e){setError(e.message)}finally{setBusy(false)}
    }
    async function q4Change(enabled){setBusy(true);setError('');try{setState(await apiClient.patch('/driving-preferences/q4/settings',{enabled}))}catch(e){setError(e.message)}finally{setBusy(false)}}
    async function restart(){setBusy(true);setError('');try{await apiClient.post('/driving-preferences/q4/restart',{});window.dispatchEvent(new Event('anjeon:profile-updated'));navigate('/onboarding?q4=true')}catch(e){setError(e.message)}finally{setBusy(false)}}
    return <section className="route-card" style={{padding:16,marginBottom:20}}>
        <h2 style={{fontSize:18}}>나의 추천 설정 <small>파일럿</small></h2>
        {error&&<p role="alert">{error}</p>}
        {state&&<>
            <Q4PreferenceSummary value={state.q4}/>
            <label style={{display:'flex',gap:10,marginBottom:12}}><input type="checkbox" checked={state.q4?.enabled??false} disabled={busy} onChange={e=>q4Change(e.target.checked)}/>시간·거리 설문을 추천에 참고</label>
            {!confirmRestart?<button disabled={busy} onClick={()=>setConfirmRestart(true)}>경로 비교 설문 다시하기</button>:<div><p className="service-note">부담 순위는 유지하고 행동 보정은 설문 초기값으로 돌아갑니다. 이전 응답·선택 기록은 보존됩니다.</p><button disabled={busy} onClick={restart}>새 설문 시작</button> <button disabled={busy} onClick={()=>setConfirmRestart(false)}>취소</button></div>}
            <h3 style={{fontSize:16,marginTop:22}}>행동 개인화 · 실제 이용 기반 보정</h3>
            <p className="service-note">{state.notice}</p>
            <label style={{display:'flex',gap:12,margin:'16px 0'}}><input type="checkbox" checked={state.enabled} disabled={busy} onChange={e=>change(e.target.checked)}/>실제 경로 선택을 다음 추천에 반영</label>
            <p className="service-note">{!state.enabled?'행동 보정을 껐습니다. 설문 기준으로 추천합니다.':reasons[state.latestJob?.reason]||'선택 이력을 모으는 중입니다. Q4 설문은 포함하지 않습니다.'}</p>
            <dl className="route-features">{BURDEN_FACTORS.map((f,i)=><div key={f.code}><dt>{f.label}</dt><dd>{Math.round(state.effectiveWeights[i]*100)}%</dd></div>)}</dl>
            <p className="service-note">행동 반영 비중 {Math.round(state.alpha*100)}% · 현재 {state.latestJob?.evidence?.search_count??0}건</p>
            <button disabled={busy} onClick={()=>change(null)} style={{padding:10,marginTop:14}}>설문 기준으로 초기화</button>
            <p className="service-note">끄기·켜기·초기화 이후 새 선택부터 집계합니다. 과거 선택 기록은 보존됩니다.</p>
        </>}
    </section>
}
