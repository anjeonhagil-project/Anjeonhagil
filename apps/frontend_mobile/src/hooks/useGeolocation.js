// Explicit foreground tracking only. Stop on hide, unmount, permission error or completion.
import {useEffect,useState} from 'react'
export default function useGeolocation(enabled,onPosition){
    const [error,setError]=useState('')
    useEffect(()=>{
        if(!enabled)return
        setError('')
        if(!window.isSecureContext){setError('GPS 안내는 HTTPS 또는 이 기기의 localhost에서 사용할 수 있어요.');return}
        if(!navigator.geolocation){setError('이 브라우저는 위치 추적을 지원하지 않아요.');return}
        let watch=null,active=true
        const stop=()=>{if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null}
        const start=()=>{
            if(document.hidden){stop();setError('화면이 숨겨져 위치 추적을 멈췄어요. 화면으로 돌아오면 다시 연결합니다.');return}
            setError('');stop()
            watch=navigator.geolocation.watchPosition(p=>{
                if(!active||document.hidden)return
                setError('');onPosition({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,heading:p.coords.heading,speed:p.coords.speed,timestamp:p.timestamp})
            },e=>{if(active){setError(e.code===1?'위치 권한이 거부됐어요. 브라우저 설정에서 허용한 뒤 다시 시작해주세요.':e.code===3?'위치를 받는 데 시간이 걸리고 있어요.':'현위치를 확인할 수 없어요.');if(e.code===1)stop()}},{enableHighAccuracy:true,maximumAge:0,timeout:10000})
        }
        start();document.addEventListener('visibilitychange',start)
        return ()=>{active=false;stop();document.removeEventListener('visibilitychange',start)}
    },[enabled,onPosition])
    return error
}
