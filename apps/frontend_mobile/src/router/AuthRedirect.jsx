// 세션·약관·Q1/Q2/Q4 서버 상태를 확인하며 소셜 재인증 복귀 경로를 보존한다.
import {useEffect} from 'react'
import {useNavigate,useLocation} from 'react-router-dom'
import {useAuth} from '../hooks/useAuth.js'
export const LOCATION_PERMISSION_SEEN_KEY='anjeonhagil:locationPermissionSeen'
const PUBLIC=['/','/login','/signup','/email-verify','/forgot-password']
export default function AuthRedirect(){
    const {isAuthenticated,profile,termsAgreed,loading}=useAuth()
    const navigate=useNavigate(),location=useLocation()
    useEffect(()=>{
        if(loading)return
        const path=location.pathname
        if(!isAuthenticated){if(!PUBLIC.includes(path)&&!path.startsWith('/terms/'))navigate('/login',{replace:true});return}
        if(!profile||termsAgreed===null)return
        const requested=Number(sessionStorage.getItem('profile_reauth_requested_at'))
        if((path==='/'||path==='/home')&&requested>0&&Date.now()-requested<600000){navigate('/my/profile?reauth=1',{replace:true});return}
        if(path==='/forgot-password'||path==='/email-verify'||path.startsWith('/terms'))return
        if(!termsAgreed){navigate('/terms',{replace:true});return}
        if(localStorage.getItem(LOCATION_PERMISSION_SEEN_KEY)!=='true'){
            if(path!=='/location-permission')navigate('/location-permission',{replace:true})
            return
        }
        if(!profile.onboarding){if(path!=='/onboarding'&&path!=='/my/driving-preferences')navigate('/onboarding',{replace:true});return}
        if(['/','/login','/signup'].includes(path))navigate('/home',{replace:true})
    },[isAuthenticated,profile,termsAgreed,loading,location.pathname,navigate])
    return null
}
