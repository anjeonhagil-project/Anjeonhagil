// 검색·실제 노출·명시적 최종 선택을 구분하며 새로고침 때 저장된 검색을 복구한다.
import {useEffect,useRef,useState} from 'react'
import {useLocation,useNavigate,useSearchParams} from 'react-router-dom'
import Header from '../../components/layout/Header.jsx'
import RouteMap from '../../components/map/RouteMap.jsx'
import RouteCandidateCard from './RouteCandidateCard.jsx'
import {searchRoutes,getSearch,recordRouteChoice} from './api.js'
import {useRouteExposure} from './useRouteExposure.js'
import './serviceRoutes.css'
import './journey.css'
export default function RouteComparePage() {
    const location=useLocation(),navigate=useNavigate(),[params,setParams]=useSearchParams()
    const inputRef=useRef(null),promiseRef=useRef(null),choiceRef=useRef(crypto.randomUUID())
    const [result,setResult]=useState(null),[selected,setSelected]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[chosen,setChosen]=useState(false),[attempt,setAttempt]=useState(0)
    useEffect(()=>{
        let active=true
        const savedId=params.get('search')
        if(!inputRef.current && location.state?.origin && location.state?.destination) inputRef.current={searchId:crypto.randomUUID(),origin:location.state.origin,destination:location.state.destination,departureAt:location.state.departureAt||new Date().toISOString()}
        if(!savedId&&!inputRef.current) {navigate('/search',{replace:true});return}
        setLoading(true);setError('')
        if(!promiseRef.current) promiseRef.current=savedId?getSearch(savedId):searchRoutes(inputRef.current)
        promiseRef.current.then(data=>{
            if(!active)return
            setResult(data);setSelected(data.selectedCandidateId||data.recommendedCandidateId);setChosen(!!data.selectedCandidateId)
            if(!savedId)setParams({search:data.searchId},{replace:true})
        }).catch(e=>{if(active)setError(e.message)}).finally(()=>active&&setLoading(false))
        return ()=>{active=false}
    },[attempt])
    const exposure=useRouteExposure({searchId:result?.searchId,candidateIds:result?.candidates.map(c=>c.candidate_id),recommendedCandidateId:result?.recommendedCandidateId,enabled:!!result&&!loading&&!chosen})
    async function choose(){
        if(!selected||!exposure.isRecorded||saving)return
        setSaving(true);setError('')
        try {await recordRouteChoice(exposure.exposureId,{choiceEventId:choiceRef.current,selectedCandidateId:selected});setChosen(true)}
        catch(e){setError(e.message)}finally{setSaving(false)}
    }
    const [expanded,setExpanded]=useState(true)
    return <main className="service-page compare-page journey-wide">
        <Header title={chosen?'선택한 경로':'경로 비교'} onBack={()=>navigate('/search')}/>
        <div className="service-content compare-layout">
            {loading&&<section className="route-loading" role="status"><span className="route-spinner"/><h2>내게 맞는 길을 찾고 있어요</h2><p>도로 연결과 운전 부담을 계산합니다.<br/>약 5~30초가 걸릴 수 있어요.</p></section>}
            {error&&<section role="alert" className="service-error">{error}<button onClick={()=>{promiseRef.current=null;setAttempt(v=>v+1)}}>다시 시도</button></section>}
            {result&&!loading&&<>
                <div className="compare-map"><RouteMap candidates={result.candidates} selectedId={selected} onSelect={chosen?undefined:setSelected} origin={result.origin} destination={result.destination} height="100%"/></div>
                <section className={'compare-panel'+(expanded?'':' collapsed')}>
                <button className="compare-toggle" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'경로 정보 접기':'경로 정보 펼치기'} <span aria-hidden="true">{expanded?'⌄':'⌃'}</span></button>
                <p className="route-endpoints">{result.origin.name||'출발지'} → {result.destination.name||'도착지'}</p>
                <div className="compare-details" hidden={!expanded}>
                <p className="service-note">{result.notice}</p>
                <p className="service-note">생성한 후보 안에서 시간·거리·운전 부담을 비교합니다.</p>
                {result.q4?.applied&&<p className="service-note">{result.q4.changed?'추천 평가가 비슷한 후보 중 시간·거리 설문 응답을 참고해 골랐어요.':'시간·거리 설문 응답을 참고했으며 기존 추천을 유지했어요.'}</p>}
                {result.degraded&&<p className="service-note">계산 시간 안에 검증된 후보를 비교합니다. 전체 도로에서 최적임을 보장하지 않습니다.</p>}
                {result.candidates.length===1&&<p>세 기준에서 같은 경로가 선정되어 하나로 표시합니다.</p>}
                <div className="route-list">{result.candidates.filter(c=>!chosen||c.candidate_id===selected).map(c=><RouteCandidateCard key={c.candidate_id} candidate={c} candidates={result.candidates} weights={result.profile?.effective_weights} selected={c.candidate_id===selected} recommended={c.candidate_id===result.recommendedCandidateId} onSelect={()=>!chosen&&setSelected(c.candidate_id)}/>)}</div>
                {exposure.error&&<p role="alert">{exposure.error} <button onClick={exposure.retry}>기록 다시 시도</button></p>}
                <p className="service-note">{result.recommendationMethod==='survey_fallback'?'모델을 사용할 수 없어 설문 기준으로 비교합니다.':'추천 모델은 팀의 합성 선택 데이터로 학습했습니다. 실제 이용자 성능은 아직 검증하지 않았습니다.'}</p>
                </div>
                <div className="compare-footer">{!chosen?<button className="service-primary" disabled={!exposure.isRecorded||saving} onClick={choose}>{saving?'저장 중…':'이 경로 선택하기'}</button>:<section className="route-success" role="status"><h2>경로 선택을 저장했어요</h2><p>선택한 경로로 GPS 안내 또는 시뮬레이션을 시작하세요.</p><button className="service-primary" onClick={()=>navigate('/navigation?search='+result.searchId)}>이 경로 안내 시작</button></section>}</div>
                </section>
            </>}
        </div>
    </main>
}
