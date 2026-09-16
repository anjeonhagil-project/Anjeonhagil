// 사용자가 행동 보정을 끄거나 이력 반영 시작점을 초기화할 수 있다. 원본 선택 로그는 삭제하지 않는다.
import {useEffect,useState} from 'react'
import {apiClient} from '../../lib/apiClient.js'
import {BURDEN_FACTORS} from '../preferences/preferenceFields.js'
import '../routes/serviceRoutes.css'
const reasons={INSUFFICIENT_ACTUAL_CHOICES:'실제 경로 선택 이력이 아직 부족합니다.',AT_LEAST_TWO_PREFERENCES_REQUIRED:'부담 항목을 두 개 이상 선택하면 보정할 수 있습니다.',NO_VALID_IMPROVEMENT:'최근 검증에서 개선이 없어 현재 설정을 유지합니다.',VALIDATION_IMPROVED:'최근 검증에서 개선된 가중치를 적용했습니다.',STALE_PROFILE_OR_MODEL_OR_DISABLED:'설정 변경을 감지해 이전 갱신을 보류했습니다.'}
export default function PersonalizationSettings(){
    const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
    useEffect(()=>{apiClient.get('/driving-preferences/personalization').then(setState).catch(e=>setError(e.message))},[])
    async function change(enabled){
        setBusy(true);setError('')
        try{setState(await apiClient.post('/driving-preferences/personalization/reset',{enabled}))}catch(e){setError(e.message)}finally{setBusy(false)}
    }
    return <section className="route-card" style={{padding:16,marginBottom:20}}>
        <h2 style={{fontSize:18}}>행동 개인화 <small>파일럿</small></h2>
        {error&&<p role="alert">{error}</p>}
        {state&&<>
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
