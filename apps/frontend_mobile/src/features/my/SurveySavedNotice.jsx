import {useEffect,useState} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import styles from './SurveySavedNotice.module.css'
export default function SurveySavedNotice(){
    const location=useLocation(),navigate=useNavigate()
    const [visible,setVisible]=useState(!!location.state?.surveySaved)
    useEffect(()=>{
        if(!location.state?.surveySaved)return
        setVisible(true)
        navigate(location.pathname,{replace:true,state:{...location.state,surveySaved:false}})
    },[location.state?.surveySaved])
    useEffect(()=>{if(!visible)return;const timer=setTimeout(()=>setVisible(false),5000);return()=>clearTimeout(timer)},[visible])
    return visible?<div role="status" className={styles.notice}>변경사항이 저장되었습니다.<button aria-label="저장 알림 닫기" onClick={()=>setVisible(false)}>×</button></div>:null
}
