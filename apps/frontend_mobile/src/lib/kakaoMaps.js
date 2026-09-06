// 기능: Kakao Maps/Local SDK 초기화 및 지도/장소검색 공통 helper
const KAKAO_MAP_SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js'

let loadPromise = null

// Kakao Maps SDK 스크립트를 1회만 로드하고, 로드 완료(window.kakao.maps 사용 가능) 시점의 kakao 객체를 반환
export function loadKakaoMaps() {
    if (loadPromise) return loadPromise

    loadPromise = new Promise((resolve, reject) => {
        if (window.kakao?.maps?.load) {
            window.kakao.maps.load(() => resolve(window.kakao))
            return
        }

        const script = document.createElement('script')
        const key = import.meta.env.VITE_KAKAO_JS_KEY?.trim()
        if (!key) {
            reject(new Error('카카오 지도 키가 설정되지 않았습니다.'))
            return
        }
        script.src = `${KAKAO_MAP_SDK_URL}?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`
        script.onload = () => {
            if (!window.kakao?.maps?.load) {
                script.remove()
                reject(new Error('카카오 지도를 초기화할 수 없습니다. 새로고침해주세요.'))
                return
            }
            window.kakao.maps.load(() => resolve(window.kakao))
        }
        script.onerror = () => {
            script.remove()
            reject(new Error('지도를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.'))
        }
        document.head.appendChild(script)
    }).catch((error) => {
        loadPromise = null
        throw error
    })

    return loadPromise
}
