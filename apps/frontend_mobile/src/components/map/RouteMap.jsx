// 서버 LineString을 카카오 지도에 표시하며 지도 클릭은 경로 미리보기만 변경한다.
import { useEffect,useRef,useState } from 'react'
import { loadKakaoMaps } from '../../lib/kakaoMaps.js'
export default function RouteMap({candidates=[],selectedId,onSelect,origin,destination,height=300}) {
    const container=useRef(null),instance=useRef(null),selectRef=useRef(onSelect)
    const [ready,setReady]=useState(false),[error,setError]=useState('')
    selectRef.current=onSelect
    useEffect(()=>{
        let active=true,observer
        loadKakaoMaps().then(kakao=>{
            if(!active||!container.current) return
            const map=new kakao.maps.Map(container.current,{center:new kakao.maps.LatLng(37.505,127.035),level:5})
            instance.current={kakao,map}
            observer=new ResizeObserver(()=>map.relayout());observer.observe(container.current)
            setReady(true)
        }).catch(e=>active&&setError(e.message||'지도를 불러올 수 없습니다'))
        return ()=>{active=false;observer?.disconnect();instance.current=null}
    },[])
    useEffect(()=>{
        if(!ready||!instance.current) return
        const {kakao,map}=instance.current,lines=[],markers=[]
        const bounds=new kakao.maps.LatLngBounds()
        for(const c of candidates) {
            const path=c.geometry.coordinates.map(([lng,lat])=>new kakao.maps.LatLng(lat,lng))
            path.forEach(p=>bounds.extend(p))
            const line=new kakao.maps.Polyline({map,path,strokeWeight:c.candidate_id===selectedId?7:4,strokeColor:c.candidate_id===selectedId?'#087f8c':'#a7b6c6',strokeOpacity:.9,zIndex:c.candidate_id===selectedId?3:1})
            const click=()=>selectRef.current?.(c.candidate_id)
            kakao.maps.event.addListener(line,'click',click);lines.push([line,click])
        }
        for(const p of [origin,destination].filter(Boolean)) {
            const position=new kakao.maps.LatLng(p.lat,p.lng);bounds.extend(position)
            markers.push(new kakao.maps.Marker({map,position,title:p.name||''}))
        }
        if(candidates.length||origin||destination) map.setBounds(bounds,30,30,30,30)
        return ()=>{lines.forEach(([l,f])=>{kakao.maps.event.removeListener(l,'click',f);l.setMap(null)});markers.forEach(m=>m.setMap(null))}
    },[ready,candidates,selectedId,origin,destination])
    return <section aria-label="경로 지도" style={{position:'relative',height,borderRadius:16,overflow:'hidden',background:'#e9eef1'}}>
        <div ref={container} style={{height:'100%',width:'100%'}} />
        {error&&<p role="alert" style={{position:'absolute',inset:16,background:'#fff',padding:16}}>{error}<br/>아래 카드에서 계산된 경로 조건은 확인할 수 있습니다.</p>}
    </section>
}
