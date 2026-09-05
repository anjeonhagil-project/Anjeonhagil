// # 기능: favorites feature에서 사용하는 Express API 함수 모음
import { apiClient } from '../../lib/apiClient.js'

// 로그인 사용자의 즐겨찾기 목록 조회
export function getFavorites() {
	return apiClient.get('/places/favorites')
}

// 장소 정보를 즐겨찾기로 저장
export function createFavorite({ placeType, placeName, customName, address, longitude, latitude }) {
	return apiClient.post('/places/favorites', {
		placeType,
		placeName,
		customName,
		address,
		geom: {
			type: 'Point',
			coordinates: [longitude, latitude],
		},
	})
}

// 저장된 즐겨찾기 정보 수정
export function updateFavorite(favoriteId, payload) {
	return apiClient.patch(`/places/favorites/${favoriteId}`, payload)
}

// 저장된 즐겨찾기 삭제
export function deleteFavorite(favoriteId) {
	return apiClient.delete(`/places/favorites/${favoriteId}`)
}
