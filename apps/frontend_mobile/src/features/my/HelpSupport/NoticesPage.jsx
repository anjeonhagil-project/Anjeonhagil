// 공개 공지는 DB에서 읽고 상세는 같은 화면에서 펼친다.
import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import Header from '../../../components/layout/Header.jsx'
import {apiClient} from '../../../lib/apiClient.js'
import '../../routes/serviceRoutes.css'
export default function NoticesPage(){
    const navigate=useNavigate(),[items,setItems]=useState(null),[error,setError]=useState('')
    useEffect(()=>{apiClient.get('/notices').then(setItems).catch(e=>setError(e.message))},[])
    return <main className="service-page"><Header title="공지사항" onBack={()=>navigate('/my/support')}/><div className="service-content">
        {error&&<p role="alert">{error}</p>}{items===null&&!error&&<p>불러오는 중…</p>}{items?.length===0&&<p>등록된 공지사항이 없습니다.</p>}
        {items?.map(n=><details className="route-card" style={{padding:16}} key={n.id}><summary>{n.title}<small style={{display:'block',marginTop:8}}>{new Date(n.published_at).toLocaleDateString('ko-KR')}</small></summary><p style={{whiteSpace:'pre-wrap',lineHeight:1.7}}>{n.content}</p></details>)}
    </div></main>
}
