// 지도 SDK를 한 번 로드하고 실패·대기 초과를 사용자에게 안내한다.
const SDK='https://dapi.kakao.com/v2/maps/sdk.js'
let pending=null
export function loadKakaoMaps() {
    if(pending)return pending
    pending=new Promise((resolve,reject)=>{
        let script,done=false
        const finish=(error)=>{
            if(done)return
            done=true;clearTimeout(timer)
            if(error){script?.remove();reject(error)}else resolve(window.kakao)
        }
        const timer=setTimeout(()=>finish(new Error('지도 응답이 지연되고 있습니다. 네트워크와 카카오 허용 주소를 확인해주세요.')),15000)
        const ready=()=>window.kakao?.maps?.load?window.kakao.maps.load(()=>finish()):finish(new Error('카카오 지도를 초기화할 수 없습니다.'))
        if(window.kakao?.maps?.load){ready();return}
        const key=import.meta.env.VITE_KAKAO_JS_KEY?.trim()
        if(!key){finish(new Error('카카오 지도 키가 설정되지 않았습니다.'));return}
        script=document.createElement('script')
        script.src=SDK+'?appkey='+encodeURIComponent(key)+'&autoload=false&libraries=services'
        script.onload=ready
        script.onerror=()=>finish(new Error('지도를 불러오지 못했습니다. 네트워크와 카카오 허용 주소('+window.location.origin+')를 확인해주세요.'))
        document.head.appendChild(script)
    }).catch(error=>{pending=null;throw error})
    return pending
}
