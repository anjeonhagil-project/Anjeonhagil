// 실시간 조회한 운영 수치와 한국 시간별 검색 집계를 표시한다. 합성 모델 성능은 별도로 표기한다.
import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {Users,Route,CheckCheck,TriangleAlert,RefreshCw,ArrowUpRight,Database,Activity} from 'lucide-react'
import {apiClient} from '../../lib/apiClient.js'
import DashboardUsageChart from './components/DashboardUsageChart.jsx'
import './operations.css'
export default function DashboardPage(){
    const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
    const [period,setPeriod]=useState('today'),[usage,setUsage]=useState(null),[usageError,setUsageError]=useState('')
    useEffect(()=>{let live=true;setError('');apiClient('/admin/operations/summary').then(r=>{if(live)setData(r.data)}).catch(e=>live&&setError(e.message));return()=>{live=false}},[attempt])
    useEffect(()=>{let live=true;setUsage(null);setUsageError('');apiClient('/admin/operations/usage?period='+period).then(r=>{if(live)setUsage(r.data)}).catch(e=>live&&setUsageError(e.message));return()=>{live=false}},[period,attempt])
    const peak=Math.max(...(usage?.items.map(i=>i.value)||[]),0)
    return <section className="operations">
        <div className="operations-heading"><div><span className="ops-eyebrow">OVERVIEW</span><h1>서비스 운영 현황</h1><p className="ops-muted">안전하길의 이용 현황과 데이터 연결 상태를 한눈에 확인하세요.</p></div><button onClick={()=>setAttempt(v=>v+1)}><RefreshCw size={15}/> 새로고침</button></div>
        {error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">운영 현황을 불러오는 중입니다…</p>}
        {data&&<>
            <div className="operations-stats">{[
                ['전체 회원',data.counts.users,'명',Users,'/members','서비스에 등록된 회원'],
                ['저장된 검색',data.counts.searches,'건',Route,'/routes','검산 후 저장된 검색'],
                ['실제 선택',data.counts.choices,'건',CheckCheck,'/routes','사용자가 확정한 경로'],
                ['기록된 실패',data.counts.failures,'건',TriangleAlert,'/datasets/failure','실패 기록 확인이 필요해요'],
            ].map(([title,n,unit,Icon,to,description],i)=><Link to={to} className={'ops-stat '+(i===3?'ops-stat-warning':'')} key={title}><div><span>{title}</span><Icon size={19}/></div><strong>{n.toLocaleString()}<small>{unit}</small></strong><p>{description}<ArrowUpRight size={14}/></p></Link>)}</div>
            <div className="ops-status-strip"><span className={'ops-pill '+(data.worker.ok?'':'ops-pill-warning')}><Activity size={14}/>계산기: {data.worker.ok?'정상 응답':'계산 중이거나 연결 확인 필요'}</span><span className="ops-pill"><Database size={14}/>{data.active?'검증된 도로 데이터 활성':'활성 데이터 확인 필요'}</span><Link to="/inquiries">문의 {data.counts.inquiries.toLocaleString()}건 확인 →</Link></div>
        </>}
        <article className="operations-panel ops-chart-panel">
            <div className="operations-heading"><div><h2>기간별 경로 검색</h2><p className="ops-muted">한국 시간 기준 · 성공적으로 저장된 서비스 검색 · 최대 30초 간격 갱신</p></div><div className="ops-tabs" role="group" aria-label="통계 기간">{[['today','오늘'],['month','이번 달'],['year','올해']].map(([key,label])=><button key={key} aria-pressed={period===key} onClick={()=>setPeriod(key)}>{label}</button>)}</div></div>
            {usageError?<p role="alert">{usageError}</p>:!usage?<div className="ops-chart-empty" role="status">검색 통계를 불러오는 중입니다…</div>:<><div className="ops-chart-total"><strong>{usage.total.toLocaleString()}</strong> 건 <span>조회 기간 내 저장된 검색</span></div>{usage.total===0&&<p className="ops-empty-note">아직 저장된 검색이 없습니다. 사용자가 경로를 검색하면 통계가 표시됩니다.</p>}<div className="operations-scroll"><DashboardUsageChart data={usage.items.map(i=>({...i,highlight:peak>0&&i.value===peak}))}/></div><p className="ops-muted">마지막 조회 {new Date(usage.updatedAt).toLocaleTimeString('ko-KR')}</p></>}
        </article>
        {data&&<div className="ops-two-columns"><article className="operations-panel"><div className="operations-heading"><h2>데이터 연결</h2><Link to="/datasets">상세 보기 →</Link></div><div className="ops-connection"><span className="ops-dot"/>도로망 · 백엔드 SQLite/GPKG</div><div className="ops-connection"><span className="ops-dot"/>회원 · 검색 · 선택 이력 · Supabase</div><p className="ops-muted">활성 데이터</p><code>{data.active?.release_id||'없음'}</code></article><article className="operations-panel"><div className="operations-heading"><h2>운영 모델</h2><span className="ops-pill">합성 데이터 평가</span></div>{data.models.filter(m=>m.is_active).map(m=><div key={m.model_version}><h3 className="ops-model-name">{m.model_type==='logistic'?'Logistic Regression':m.model_type}</h3><p>1위 일치율 <b>{m.metrics.test?.top1_accuracy!=null?(m.metrics.test.top1_accuracy*100).toFixed(1)+'%':'미측정'}</b> · Log Loss <b>{m.metrics.test?.log_loss?.toFixed(4)??'미측정'}</b></p><p className="ops-muted">실제 이용자 성능과 사고 위험은 검증하지 않았습니다.</p></div>)}</article></div>}
    </section>
}
