// 권한 변경은 확인 후 저장하며 실패·성공 결과를 명시한다. 서버에서도 슈퍼관리자 권한을 검증한다.
import {useEffect,useRef,useState} from 'react'
import {useOutletContext} from 'react-router-dom'
import {ShieldCheck,Search,RefreshCw} from 'lucide-react'
import {apiClient} from '../../lib/apiClient.js'
import './operations.css'
function Confirm({pending,busy,onClose,onConfirm}){
    const ref=useRef(null)
    useEffect(()=>ref.current.showModal(),[])
    return <dialog ref={ref} className="ops-dialog" aria-labelledby="admin-confirm-title" onCancel={e=>{if(busy)e.preventDefault();else onClose()}}><ShieldCheck size={30} color="#07817c"/><h2 id="admin-confirm-title" style={{marginTop:16}}>관리자 권한을 변경할까요?</h2><p style={{margin:'16px 0',overflowWrap:'anywhere'}}>{pending.label}</p><p className="ops-muted">저장하면 해당 계정의 관리자 접근 권한에 즉시 반영됩니다.</p><div className="ops-pagination"><button disabled={busy} onClick={onClose}>취소</button><button className="ops-primary" disabled={busy} onClick={onConfirm}>{busy?'저장 중…':'변경 확인'}</button></div></dialog>
}
export default function AdminsPage(){
    const {admin}=useOutletContext()
    const [items,setItems]=useState([]),[error,setError]=useState(''),[id,setId]=useState(''),[role,setRole]=useState('admin'),[busy,setBusy]=useState(false),[pending,setPending]=useState(null),[message,setMessage]=useState(''),[search,setSearch]=useState(''),[loaded,setLoaded]=useState(false)
    const load=()=>apiClient('/admin/admins').then(r=>{setItems(r.data);setLoaded(true)})
    useEffect(()=>{if(admin.role==='super_admin')load().catch(e=>setError(e.message))},[admin.role])
    async function save(){setBusy(true);setError('');setMessage('');try{await apiClient(pending.path,{method:pending.method,body:pending.body});setPending(null);setId('');setMessage('관리자 권한을 변경했습니다.');await load()}catch(e){setError(e.message);setPending(null)}finally{setBusy(false)}}
    if(admin.role!=='super_admin')return <section className="operations"><h1>관리자 관리</h1><p>슈퍼관리자만 접근할 수 있는 화면입니다.</p></section>
    return <section className="operations"><div className="operations-heading"><div><span className="ops-eyebrow">ACCESS CONTROL</span><h1>관리자 관리</h1><p className="ops-muted">등록된 회원에게 역할을 부여하고 관리자 접근을 관리합니다.</p></div><button onClick={()=>load().catch(e=>setError(e.message))}><RefreshCw size={15}/> 새로고침</button></div>
        {error&&<p role="alert">{error}</p>}{message&&<p role="status" className="ops-pill">{message}</p>}
        <article className="operations-panel"><h2>새 관리자 등록</h2><p className="ops-muted" style={{marginBottom:18}}>회원 관리에서 확인한 UUID를 입력하세요. 이미 등록된 관리자는 아래 목록에서 변경합니다.</p><form onSubmit={e=>{e.preventDefault();setPending({path:'/admin/admins',method:'POST',body:{adminId:id.trim(),role},label:id.trim()+' 계정에 '+(role==='admin'?'관리자':'슈퍼관리자')+' 권한을 부여합니다.'})}}><label>기존 회원 ID <input required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" value={id} onChange={e=>setId(e.target.value)} placeholder="회원 UUID"/></label><select aria-label="부여할 역할" value={role} onChange={e=>setRole(e.target.value)}><option value="admin">관리자</option><option value="super_admin">슈퍼관리자</option></select><button className="ops-primary" disabled={busy}>권한 부여</button></form></article>
        <article className="operations-panel"><div className="ops-toolbar"><label className="ops-search"><Search size={17}/><input aria-label="관리자 검색" type="search" placeholder="이메일로 관리자 검색" value={search} onChange={e=>setSearch(e.target.value)}/></label><span className="ops-muted">전체 {items.length}명</span></div><div className="operations-scroll"><table><thead><tr><th>이메일</th><th>역할</th><th>상태</th><th>변경</th></tr></thead><tbody>{items.filter(a=>a.email.toLowerCase().includes(search.toLowerCase())).map(a=><tr key={a.id}><td>{a.email}</td><td><select aria-label={a.email+' 역할'} value={a.role} disabled={busy} onChange={e=>setPending({path:'/admin/admins/'+a.id,method:'PATCH',body:{role:e.target.value},label:a.email+' 계정의 역할을 '+(e.target.value==='admin'?'관리자':'슈퍼관리자')+'로 변경합니다.'})}><option value="admin">관리자</option><option value="super_admin">슈퍼관리자</option></select></td><td><span className={'ops-pill '+(!a.is_active?'ops-pill-neutral':'')}>{a.is_active?'활성':'비활성'}</span></td><td><button disabled={busy} onClick={()=>setPending({path:'/admin/admins/'+a.id,method:'PATCH',body:{isActive:!a.is_active},label:a.email+' 계정을 '+(a.is_active?'비활성화':'활성화')+'합니다.'})}>{a.is_active?'비활성화':'활성화'}</button></td></tr>)}</tbody></table></div>{!loaded&&!error&&<p role="status">관리자 목록을 불러오는 중입니다…</p>}{loaded&&!items.some(a=>a.email.toLowerCase().includes(search.toLowerCase()))&&<div className="ops-empty">일치하는 관리자가 없습니다.</div>}</article>
        {pending&&<Confirm pending={pending} busy={busy} onClose={()=>setPending(null)} onConfirm={save}/>}
    </section>
}
