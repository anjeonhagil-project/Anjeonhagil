// 기능: Kakao Maps/Local SDK 초기화 및 지도/장소검색 공통 helper
const KAKAO_MAP_SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js'

let loadPromise = null

// Kakao Maps SDK 스크립트를 1회만 로드하고, 로드 완료(window.kakao.maps 사용 가능) 시점의 kakao 객체를 반환
export function loadKakaoMaps() {
    if (loadPromise) return loadPromise

    loadPromise = new Promise((resolve, reject) => {
        if (window.kakao?.maps) {
            resolve(window.kakao)
            return
        }

        const script = document.createElement('script')
        script.src = `${KAKAO_MAP_SDK_URL}?appkey=${import.meta.env.VITE_KAKAO_JS_KEY}&autoload=false`
        script.onload = () => {
            window.kakao.maps.load(() => resolve(window.kakao))
        }
        script.onerror = () => reject(new Error('Kakao Maps SDK 로드에 실패했습니다'))
        document.head.appendChild(script)
    })

    return loadPromise
}
