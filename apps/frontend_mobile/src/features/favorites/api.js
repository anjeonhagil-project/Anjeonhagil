// # 기능: favorites feature에서 사용하는 Express API 함수 모음
import { apiClient } from '../../lib/apiClient.js'
import { buildCreateFavoritePayload } from './favoriteContract.js'

// 로그인 사용자의 즐겨찾기 목록 조회
export function getFavorites(placeType) {
	return apiClient.get(`/favorites${placeType ? `?type=${encodeURIComponent(placeType)}` : ''}`)
}

// 장소 정보를 즐겨찾기로 저장
export function createFavorite(place) {
	return apiClient.post('/favorites', buildCreateFavoritePayload(place))
}

// 저장된 즐겨찾기 정보 수정
export function updateFavorite(favoriteId, payload) {
	return apiClient.patch(`/favorites/${favoriteId}`, payload)
}

// 저장된 즐겨찾기 삭제
export function deleteFavorite(favoriteId) {
	return apiClient.delete(`/favorites/${favoriteId}`)
}
