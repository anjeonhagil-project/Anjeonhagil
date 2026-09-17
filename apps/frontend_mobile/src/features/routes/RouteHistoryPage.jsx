// 최근 검색과 실제 선택 완료 여부를 조회하고 당시 저장된 경로를 복구한다.
import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import Header from '../../components/layout/Header.jsx'
import {getHistory} from './api.js'
import './serviceRoutes.css'
import styles from './RouteHistoryPage.module.css'

export default function RouteHistoryPage(){
    const navigate=useNavigate(),[items,setItems]=useState(null),[error,setError]=useState('')
    useEffect(()=>{getHistory().then(setItems).catch(e=>setError(e.message))},[])
    return (
        <main className="service-page">
            <Header title="최근 경로" onBack={()=>navigate('/my')}/><div className="service-content">
            {error&&<p role="alert">{error}</p>}
            {items===null&&!error&&<p>불러오는 중…</p>}
            {items?.length===0&&<p>아직 검색한 경로가 없습니다.</p>}
            
            {items?.map(s=><button className={`route-card ${styles.card}`} key={s.search_id} onClick={()=>navigate('/route-compare?search='+s.search_id)}><strong>{s.origin.name||'출발지'} → {s.destination.name||'도착지'}</strong><p>{new Date(s.created_at).toLocaleString('ko-KR')} · {s.choice?'선택 완료':'비교 중'}</p></button>)}
        </div></main>
    )
}
