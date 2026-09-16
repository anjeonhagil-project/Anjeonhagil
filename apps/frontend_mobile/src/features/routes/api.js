// 수정 필요(Anjeonhagil): 검색→실제 노출→최종 선택 API를 연결한다. 재시도 시 같은 이벤트 ID를 사용하고 user_id/피처/계산 버전을 브라우저에서 지정하지 않는다.
// # 기능: routes feature에서 사용하는 Express API 함수 모음
import { apiClient } from '../../lib/apiClient.js'

// 출발지/도착지 기준 최단시간/최단거리 경로 조회
export function getDirections({ origin, destination }) {
    const params = new URLSearchParams({
        originLat: origin.lat,
        originLng: origin.lng,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
    })
    return apiClient.get(`/routes/directions?${params.toString()}`)
}
