import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import Header from '../../components/layout/Header.jsx'
import PreferenceRankForm from '../preferences/PreferenceRankForm.jsx'
import RouteChoiceStep from '../onboarding/RouteChoiceStep.jsx'
import PersonalizationSettings from './PersonalizationSettings.jsx'
import {getDrivingPreferences,updateDrivingPreferences} from './api.js'
import {apiClient} from '../../lib/apiClient.js'
import styles from './DrivingPreferencesPage.module.css'
export default function DrivingPreferencesPage(){
    const navigate=useNavigate()
    const [dirty,setDirty]=useState(false)
    const [comparisonBusy,setComparisonBusy]=useState(false)
    const [footerTarget,setFooterTarget]=useState(null)
    const [summaryTarget,setSummaryTarget]=useState(null),[actionsTarget,setActionsTarget]=useState(null)
    const [initialValue,setInitialValue]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[screen,setScreen]=useState('survey'),[attempt,setAttempt]=useState(0),[completed,setCompleted]=useState(false)
    useEffect(()=>{let active=true;setLoading(true);setError('');getDrivingPreferences().then(r=>{if(active){setInitialValue(r.preferences);setCompleted(!!r.onboarding?.routeChoicesCompleted&&r.onboarding?.usesCurrentSurvey!==false)}}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false}},[attempt])
    function finish(){window.dispatchEvent(new Event('anjeon:profile-updated'));navigate('/my',{replace:true,state:{surveySaved:true}})}
    async function save(answers){
        if(busy||screen==='q3')return
        setBusy(true);setError('')
        try{
            const unchanged=initialValue&&answers.drivingFrequency===initialValue.drivingFrequency&&JSON.stringify(answers.ranks)===JSON.stringify(initialValue.ranks)
            if(unchanged){const current=await apiClient.get('/driving-preferences/personalization');if(completed&&!current.q4?.pending&&current.q4?.status==='COMPLETE')finish();else setScreen('q3');return}
            const result=await updateDrivingPreferences(answers)
            setInitialValue(result.preferences);setCompleted(false);window.dispatchEvent(new Event('anjeon:profile-updated'));setScreen('q3')
        }catch(e){setError(e.message||'설문 저장에 실패했습니다. 다시 시도해주세요.')}finally{setBusy(false)}
    }
    return <main className={styles.page}>
        <Header title="운전 부담 설문" onBack={()=>{if(!busy&&!comparisonBusy){if(screen==='q3')setScreen('survey');else navigate('/my')}}}/>
        <section className={`${styles.content} hide-scrollbar`}>
            <p className={styles.description}>부담되는 상황과 경로 선택을 알려주세요. 답변은 언제든 바꿀 수 있어요.</p>
            {loading?<p role="status">설정을 불러오고 있어요…</p>:<>
                {error&&<p role="alert">{error}{!initialValue&&<button onClick={()=>setAttempt(v=>v+1)}>다시 시도</button>}</p>}
                {!initialValue&&!error&&<button className="service-primary" onClick={()=>navigate('/onboarding')}>운전 부담 설문 시작하기</button>}
                {initialValue&&<>
                    <div ref={setSummaryTarget}/>
                    {dirty&&<p className={styles.description}>위 요약은 현재 저장된 선호입니다. 운전 빈도나 부담 순위를 저장하면 새 설문으로 기록되며, 경로 비교 4문항도 다시 진행합니다.</p>}
                    <PreferenceRankForm initialValue={initialValue} onSubmit={save} onDirtyChange={setDirty} hideSubmit={screen==='q3'} disabled={busy||screen==='q3'} submitLabel={busy?'저장 중…':dirty||!completed?'저장하고 경로 비교':'변경사항 저장'}>
                        <section className={styles.questionCard} aria-label="Q3 경로 비교">
                            {screen==='q3'?<><p className={styles.description}>기본 설정은 저장되어 있습니다. 비교 답변은 문항마다 저장되며, 나중에 이어서 할 수 있어요.</p><RouteChoiceStep embedded footerTarget={footerTarget} onBusyChange={setComparisonBusy} onComplete={finish} completionLabel="변경사항 저장"/><button type="button" disabled={comparisonBusy} onClick={()=>setScreen('survey')}>비교 잠시 닫기</button></>:<><h2>Q3. 경로 비교</h2><p className={styles.description}>두 경로 중 하나를 고르는 비교 4문항입니다. 시간·거리와 부담되는 상황을 함께 살펴봐주세요.</p>{dirty?<p className={styles.description}>수정한 기본 설정을 먼저 저장하면 새 기준으로 비교를 시작합니다.</p>:<div ref={setActionsTarget}/>}</>}
                        </section>
                    </PreferenceRankForm>
                    <PersonalizationSettings key={initialValue.surveyVersion} ranks={initialValue.ranks} summaryTarget={summaryTarget} actionsTarget={!dirty&&screen!=='q3'?actionsTarget:null} locked={busy||screen==='q3'} onQ4={()=>{setCompleted(false);setScreen('q3')}}/>
                </>}
            </>}
        </section>
        <div ref={setFooterTarget} style={{flexShrink:0}}/>
    </main>
}
