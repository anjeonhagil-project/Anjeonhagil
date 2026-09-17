// Saved choice -> foreground GPS or simulation. No exposure, choice, or training writes.
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {useNavigate,useSearchParams} from 'react-router-dom'
import {apiClient} from '../../lib/apiClient.js'
import RouteMap from '../../components/map/RouteMap.jsx'
import BurdenTimeline from '../routes/BurdenTimeline.jsx'
import useGeolocation from '../../hooks/useGeolocation.js'
import {advanceGps,buildTrack,pointAt,validFix} from './navigationMath.js'
import './navigation.css'
const icons={left:'↰',right:'↱',uturn:'↶',arrival:'⚑'}
const meters=n=>n>=1000?`${(n/1000).toFixed(1)} km`:`${Math.max(0,Math.round(n))} m`
export default function NavigationPage(){
    const [params]=useSearchParams(),navigate=useNavigate(),searchId=params.get('search')
    const [data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
    const [mode,setMode]=useState('ready'),[progress,setProgress]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[gps,setGps]=useState({}),[voice,setVoice]=useState(false),[follow,setFollow]=useState(true),[clock,setClock]=useState(Date.now()),[exitOpen,setExitOpen]=useState(false)
    const spoken=useRef(new Set()),dialog=useRef(null)
    const [focusEvent,setFocusEvent]=useState(null)
    useEffect(()=>{let active=true;setData(null);setError('');setMode('ready');setGps({});setProgress(0)
        if(!searchId){setError('선택한 경로가 없습니다. 먼저 경로를 선택해주세요.');return}
        apiClient.get('/routes/searches/'+encodeURIComponent(searchId)+'/guidance').then(d=>{if(active){buildTrack(d.geometry,d.steps);setData(d)}}).catch(e=>active&&setError(e.message))
        return ()=>{active=false}
    },[searchId,retry])
    const track=useMemo(()=>data?buildTrack(data.geometry,data.steps):null,[data])
    const onPosition=useCallback(fix=>{if(track)setGps(old=>advanceGps(track,fix,old))},[track])
    const gpsError=useGeolocation(mode==='gps',onPosition)
    useEffect(()=>{if(mode!=='gps')return;const timer=setInterval(()=>setClock(Date.now()),1000);return ()=>clearInterval(timer)},[mode])
    useEffect(()=>{if(mode==='gps'&&gps.status==='arrived')setMode('arrived')},[mode,gps.status])
    useEffect(()=>{
        if(mode!=='demo'||!playing||!track)return
        let previous=performance.now()
        const timer=setInterval(()=>{const now=performance.now(),dt=Math.max(0,Math.min((now-previous)/1000,1));previous=now
            if(!document.hidden)setProgress(p=>Math.min(track.total,p+dt*speed*track.total/Math.max(1,data.candidate.internal_duration_s)))
        },200)
        return ()=>clearInterval(timer)
    },[mode,playing,speed,track,data])
    useEffect(()=>{if(track&&mode==='demo'&&progress>=track.total){setPlaying(false);setMode('demo-arrived')}},[track,mode,progress])
    const isDemo=mode==='demo'||mode==='demo-arrived'
    const done=mode==='arrived'||mode==='demo-arrived'
    const current=track?(isDemo?progress:gps.match?.progress||0):0
    const stale=mode==='gps'&&(!validFix(gps.fix,clock)||!!gpsError)
    const tracking=mode==='gps'&&gps.status==='tracking'&&!stale
    const position=track?(isDemo?pointAt(track,current):gps.fix):null
    const next=track?.steps.find(s=>s.at>current+8)||track?.steps.at(-1)
    const candidates=useMemo(()=>data?[{...data.candidate,geometry:data.geometry}]:[],[data])
    const remaining=track?Math.max(0,track.total-current):0
    const eta=track?Math.ceil(data.candidate.internal_duration_s*(remaining/track.total)/60):0
    useEffect(()=>{
        if(!voice||!next||done||(!tracking&&!(mode==='demo'&&playing))||!('speechSynthesis' in window))return
        const delta=next.at-current,threshold=delta<=40?'near':delta<=150?'soon':null
        const key=next.id+':'+threshold
        if(!threshold||spoken.current.has(key))return
        spoken.current.add(key)
        const utterance=new SpeechSynthesisUtterance(`${Math.max(0,Math.round(delta/10)*10)}미터 앞, ${next.instruction}`)
        utterance.lang='ko-KR';window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance)
    },[voice,next,current,tracking,mode,playing,done])
    useEffect(()=>{if(!voice||done||(!tracking&&!(mode==='demo'&&playing)))window.speechSynthesis?.cancel()},[voice,done,tracking,mode,playing])
    useEffect(()=>()=>window.speechSynthesis?.cancel(),[])
    useEffect(()=>{if(exitOpen)dialog.current?.showModal();else dialog.current?.close()},[exitOpen])
    function start(nextMode){spoken.current.clear();window.speechSynthesis?.cancel();setGps({});setProgress(0);setMode(nextMode);setPlaying(nextMode==='demo');setFollow(true)}
    function leave(){setMode('ready');setPlaying(false);window.speechSynthesis?.cancel();navigate(searchId?'/route-compare?search='+encodeURIComponent(searchId):'/search')}
    function reroute(){
        if(!validFix(gps.fix)||gpsError)return
        setMode('ready');window.speechSynthesis?.cancel()
        navigate('/route-compare',{state:{origin:{name:'현재 위치',lat:gps.fix.lat,lng:gps.fix.lng,...(Number.isFinite(gps.fix.heading)&&gps.fix.speed>2?{heading:gps.fix.heading}:{})},destination:data.destination,departureAt:new Date().toISOString()}})
    }
    return <main className="navigation-page journey-wide">
        <header className="navigation-header"><button onClick={()=>mode==='ready'||done?leave():setExitOpen(true)} aria-label="안내 나가기">←</button><strong>안전하길 <span>경로 안내</span></strong><span className="navigation-tag">{isDemo?'시뮬레이션':mode==='gps'?'GPS 안내':'안내 준비'}</span></header>
        {error?<section className="navigation-empty" role="alert"><h1>안내를 준비하지 못했어요</h1><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>다시 시도</button><button onClick={()=>navigate('/search')}>경로 검색</button></section>:!data?<section className="navigation-empty" role="status">선택한 도로의 안내를 준비하고 있어요…</section>:<>
            <section className="navigation-stage">
                <RouteMap focusEvent={focusEvent} candidates={candidates} selectedId={data.candidate.candidate_id} origin={data.origin} destination={data.destination} height="100%" position={position} progress={current} follow={follow} onPan={()=>setFollow(false)}/>
                <div className="navigation-instruction" aria-live="polite"><b aria-hidden="true">{done?'⚑':icons[next?.kind]||'↑'}</b><div><strong>{done?(isDemo?'시뮬레이션을 완료했어요':'경로 끝 지점에 도착했어요'):mode==='ready'?'선택한 경로로 출발하세요':tracking||isDemo?`${meters(Math.max(0,(next?.at||0)-current))} 앞`:'위치 확인 중'}</strong><p>{done?'목적지까지 남은 접근 구간과 주변을 확인하세요.':mode==='ready'?data.destination.name||'목적지':tracking||isDemo?next?.instruction:'정확한 위치가 확인되면 안내합니다.'}</p></div></div>
                <div className="navigation-map-tools"><button aria-pressed={follow} onClick={()=>setFollow(v=>!v)}>{follow?'위치 따라가기 켜짐':'내 위치 따라가기'}</button><button aria-pressed={voice} disabled={!('speechSynthesis' in window)} onClick={()=>setVoice(v=>!v)}>{voice?'음성 켜짐':'음성 꺼짐'}</button></div>
            </section>
            <section className="navigation-panel">
                {mode==='ready'&&<BurdenTimeline candidate={data.candidate} onFocus={e=>{setFollow(false);setFocusEvent(e)}}/>}
                <div className="navigation-summary"><div><strong>{meters(remaining)}</strong><span>경로 잔여 거리</span></div><div><strong>약 {eta}분</strong><span>과거 교통자료 기준</span></div></div>
                <progress aria-label="경로 진행률" max={track.total} value={current}/>
                {mode==='gps'&&(gpsError||stale||gps.status!=='tracking')&&!done&&<p role="status" className="navigation-warning">{gpsError|| (stale?'정확한 GPS 위치를 기다리고 있어요. 화면을 켜 둔 상태로 사용해주세요.':gps.status==='offroute'?'선택 경로에서 벗어났어요. 안전한 곳에서 다시 검색해주세요.':'위치와 진행 방향을 확인하고 있어요.')}</p>}
                {mode==='gps'&&<button disabled={!validFix(gps.fix,clock)||!!gpsError} onClick={reroute}>현재 위치에서 다시 검색</button>}
                {mode==='ready'&&<div className="navigation-actions"><button className="nav-primary" onClick={()=>start('gps')}>GPS 안내 시작</button><button onClick={()=>start('demo')}>시뮬레이션 시작</button></div>}
                {mode==='demo'&&<div className="navigation-actions"><button className="nav-primary" onClick={()=>setPlaying(v=>!v)}>{playing?'일시정지':'계속 재생'}</button><label>재생 속도 <select aria-label="재생 속도" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[1,2,4,16].map(v=><option key={v} value={v}>{v}배</option>)}</select></label><button onClick={()=>start('demo')}>처음부터</button></div>}
                {done&&<div className="navigation-actions"><button className="nav-primary" onClick={leave}>안내 마치기</button>{isDemo&&<button onClick={()=>start('demo')}>다시 재생</button>}</div>}
                {!done&&mode!=='ready'&&<button onClick={()=>setExitOpen(true)}>안내 종료</button>}
                <p className="navigation-note">{isDemo?'가상 위치로 재생 중 · 실제 주행·학습 기록에 반영되지 않습니다.':data.notice} 현재 경로는 참고 안내이며 실시간 교통·차선 안내는 포함하지 않습니다.</p>
                <details><summary>전체 안내 {track.steps.length}개</summary><ol className="navigation-steps">{track.steps.map(s=><li key={s.id} className={s.at<current?'passed':''}><span>{icons[s.kind]} {s.instruction}</span><small>출발 기준 {meters(s.at)}</small></li>)}</ol></details>
            </section>
        </>}
        <dialog ref={dialog} onCancel={()=>setExitOpen(false)} className="navigation-dialog"><h2>안내를 종료할까요?</h2><p>위치 추적과 음성 안내를 멈춥니다.</p><div className="navigation-actions"><button onClick={()=>setExitOpen(false)}>계속 안내</button><button className="nav-primary" onClick={leave}>종료하기</button></div></dialog>
    </main>
}
