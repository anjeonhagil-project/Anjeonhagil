import {useEffect,useRef,useState} from 'react'
import {recordRouteExposure} from './api.js'
// 표시된 카드만 수집한다. 요청 실패 시 동일 이벤트 ID로 재시도한다.
export function useRouteExposure({searchId,candidateIds=[],recommendedCandidateId=null,enabled=true}) {
 const nodes=useRef(new Map()),seen=useRef(new Set()),requests=useRef(new Map())
 const [revision,setRevision]=useState(0),[error,setError]=useState('')
 const signature=candidateIds.join(',')
 useEffect(()=>{seen.current.clear();requests.current.clear();setRevision(v=>v+1)},[searchId])
 useEffect(()=>{
  if(!enabled)return
  const visibleNodes=new Set()
  const inspect=()=>{
   if(document.visibilityState!=='visible')return
   let changed=false
   for(const [id,node] of nodes.current){
    if(visibleNodes.has(node)&&node.checkVisibility?.()!==false&&!seen.current.has(id)){seen.current.add(id);changed=true}
   }
   if(changed)setRevision(v=>v+1)
  }
  const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting&&e.intersectionRatio>=.5)visibleNodes.add(e.target);else visibleNodes.delete(e.target)}inspect()},{threshold:[0,.5,1]})
  nodes.current.forEach(n=>observer.observe(n));document.addEventListener('visibilitychange',inspect);inspect()
  return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',inspect)}
 },[searchId,signature,enabled])
 function register(id,node){if(node)nodes.current.set(id,node);else nodes.current.delete(id)}
 async function record(context={selectionSource:null,selectionChanges:0}){
  const ids=candidateIds.filter(id=>seen.current.has(id))
  if(!ids.length)throw new Error('선택할 경로 카드를 먼저 확인해주세요.')
  const key=JSON.stringify([searchId,ids,context])
  if(!requests.current.has(key))requests.current.set(key,{exposureId:crypto.randomUUID()})
  const r=requests.current.get(key)
  if(!r.promise)r.promise=recordRouteExposure(searchId,{exposureId:r.exposureId,candidateIds:ids,recommendedCandidateId:ids.includes(recommendedCandidateId)?recommendedCandidateId:null,context:{policy:'visible_cards_v2',...context}}).catch(e=>{r.promise=null;setError(e.message);throw e})
  const result=await r.promise;setError('');return result
 }
 useEffect(()=>{if(enabled&&searchId&&seen.current.size)record().catch(()=>{})},[searchId,revision,enabled])
 return {register,hasSeen:id=>seen.current.has(id),record,error,retry:()=>setRevision(v=>v+1)}
}
