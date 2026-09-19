import {useEffect,useState} from 'react'
import {createPortal} from 'react-dom'
import {apiClient} from '../../lib/apiClient.js'
import Q4PreferenceSummary from '../preferences/Q4PreferenceSummary.jsx'
import '../routes/serviceRoutes.css'
import styles from './PersonalizationSettings.module.css'
export default function PersonalizationSettings({ranks,onQ4,summaryTarget,actionsTarget,locked=false}){
    const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmRestart,setConfirmRestart]=useState(false)
    const [attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true)
    useEffect(()=>{let active=true;setLoading(true);setError('');apiClient.get('/driving-preferences/personalization').then(r=>active&&setState(r)).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false}},[attempt,locked])
    async function change(enabled){
        setBusy(true);setError('')
        try{setState(await apiClient.post('/driving-preferences/personalization/reset',{enabled}));window.dispatchEvent(new Event('anjeon:profile-updated'))}catch(e){setError(e.message)}finally{setBusy(false)}
    }
    async function q4Change(enabled){setBusy(true);setError('');try{setState(await apiClient.patch('/driving-preferences/q4/settings',{enabled}));window.dispatchEvent(new Event('anjeon:profile-updated'))}catch(e){setError(e.message)}finally{setBusy(false)}}
    async function restart(){setBusy(true);setError('');try{await apiClient.post('/driving-preferences/q4/restart',{});onQ4()}catch(e){setError(e.message)}finally{setBusy(false)}}
    return <section className={`route-card ${styles.card}`}>
        {summaryTarget&&createPortal(<><p className="service-note">현재 저장된 선호</p>{state&&<Q4PreferenceSummary value={state.q4} ranks={ranks}/>} {loading&&<p role="status">선호를 불러오고 있어요…</p>}{error&&<p role="alert">{error} <button type="button" disabled={busy||loading} onClick={()=>setAttempt(v=>v+1)}>선호 다시 불러오기</button></p>}</>,summaryTarget)}
        {state&&<>
            {actionsTarget&&createPortal(<>{state.q4?.pending||state.q4?.status==='INCOMPLETE'?<button type="button" disabled={busy||locked||loading||!!error} onClick={onQ4}>{state.q4?.pending?'경로 비교 이어서 하기':'경로 비교 시작하기'}</button>:!confirmRestart?<><p className="service-note">경로 비교 4문항을 완료했어요. 답변을 바꾸려면 다시 진행해주세요.</p><button type="button" disabled={busy||locked||loading||!!error} onClick={()=>setConfirmRestart(true)}>경로 비교 다시 하기</button></>:<div><p className="service-note">저장된 부담 순위는 유지하고 경로 비교 4문항을 새로 진행해요.</p><button type="button" disabled={busy||locked||loading||!!error} onClick={restart}>새 설문 시작</button> <button type="button" disabled={busy} onClick={()=>setConfirmRestart(false)}>취소</button></div>}</>,actionsTarget)}
            <fieldset disabled={busy||locked||loading} style={{border:0,padding:0,margin:0,minWidth:0}}>
            <details className={styles.settings}><summary>추천 개인화 설정</summary>
                <label className={styles.q4Toggle}><input type="checkbox" checked={state.q4?.enabled??false} disabled={busy} onChange={e=>q4Change(e.target.checked)}/>경로 비교 답변을 추천에 참고</label>
                <label className={styles.behaviorToggle}><input type="checkbox" checked={state.enabled} disabled={busy} onChange={e=>change(e.target.checked)}/>실제 경로 선택을 다음 추천에 반영</label>
                <p className="service-note">선택 기록이 충분하고 보정 효과가 확인되면 다음 검색에 반영해요.</p>
                <button className={styles.resetButton} type="button" disabled={busy} onClick={()=>change(null)}>선택 기록 반영 초기화</button>
                <p className="service-note">켜기·끄기·초기화 이후의 선택부터 반영해요. 과거 기록은 삭제하지 않아요.</p>
            </details>
            </fieldset>
        </>}
    </section>
}
