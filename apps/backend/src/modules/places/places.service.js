import * as placesRepository from './places.repository.js'
import { validateFavoritePayload } from './places.validation.js'

function notFound() {
	const error = new Error('즐겨찾기를 찾을 수 없습니다')
	error.status = 404
	return error
}

// 로그인 사용자의 즐겨찾기 목록 조회
export function listFavorites(userId) {
	return placesRepository.findFavorites(userId)
}

// 즐겨찾기 추가 및 최대 개수·장소 유형 중복 검증
export async function addFavorite(userId, payload) {
	validateFavoritePayload(payload)

	const count = await placesRepository.countFavorites(userId)
	if (count >= 5) {
		const error = new Error('즐겨찾기는 최대 5개까지 저장할 수 있습니다')
		error.status = 409
		throw error
	}

	if (payload.placeType === 'home' || payload.placeType === 'work') {
		const existing = await placesRepository.findFavoriteByType(userId, payload.placeType)
		if (existing) {
			const error = new Error(`${payload.placeType === 'home' ? '집' : '회사'} 즐겨찾기가 이미 있습니다`)
			error.status = 409
			throw error
		}
	}

	return placesRepository.createFavorite(userId, payload)
}

// 즐겨찾기 정보 수정 및 장소 유형 중복 검증
export async function editFavorite(userId, favoriteId, payload) {
	validateFavoritePayload(payload, { partial: true })
	if (Object.keys(payload).length === 0) {
		const error = new Error('수정할 값이 없습니다')
		error.status = 400
		throw error
	}

	if (payload.placeType === 'home' || payload.placeType === 'work') {
		const existing = await placesRepository.findFavoriteByType(userId, payload.placeType)
		if (existing && existing.id !== favoriteId) {
			const error = new Error(`${payload.placeType === 'home' ? '집' : '회사'} 즐겨찾기가 이미 있습니다`)
			error.status = 409
			throw error
		}
	}

	try {
		return await placesRepository.updateFavorite(userId, favoriteId, payload)
	} catch (error) {
		if (error.code === 'PGRST116') throw notFound()
		throw error
	}
}

// 로그인 사용자의 즐겨찾기 삭제
export async function removeFavorite(userId, favoriteId) {
	try {
		await placesRepository.deleteFavorite(userId, favoriteId)
	} catch (error) {
		throw error
	}
}
