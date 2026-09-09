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
