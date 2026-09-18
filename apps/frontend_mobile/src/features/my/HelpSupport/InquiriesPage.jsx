// 실제 등록한 내 문의와 관리자 답변만 표시한다.
import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import Header from '../../../components/layout/Header.jsx'
import {apiClient} from '../../../lib/apiClient.js'
import '../../routes/serviceRoutes.css'
import styles from './InquiriesPage.module.css'
export default function InquiriesPage(){
    const navigate=useNavigate(),[items,setItems]=useState(null),[error,setError]=useState('')
    useEffect(()=>{apiClient.get('/inquiries').then(setItems).catch(e=>setError(e.message))},[])
    return <main className="service-page"><Header title="내 문의" onBack={()=>navigate('/my/support')}/><div className="service-content">
        <button className="service-primary" onClick={()=>navigate('/my/support/inquiries/write')}>문의 작성</button>
        {error&&<p role="alert">{error}</p>}{items===null&&!error&&<p>불러오는 중…</p>}{items?.length===0&&<p>아직 작성한 문의가 없습니다.</p>}
        {items?.map(n=><details className={`route-card ${styles.card}`} key={n.id}><summary>{n.title}<small className={styles.meta}>{new Date(n.created_at).toLocaleDateString('ko-KR')} · {n.status==='answered'?'답변 완료':n.status==='in_review'?'확인 중':'접수 완료'}</small></summary><p className={styles.body}>{n.content}</p>{n.answer_content&&<section className="route-success"><strong>관리자 답변</strong><p className={styles.body}>{n.answer_content}</p></section>}</details>)}
    </div></main>
}
