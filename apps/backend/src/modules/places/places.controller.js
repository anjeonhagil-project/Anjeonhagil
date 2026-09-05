import * as placesService from './places.service.js'

// 즐겨찾기 관련 API 요청 처리
export async function listFavorites(req, res, next) {
	try {
		res.json({ success: true, data: await placesService.listFavorites(req.user.id) })
	} catch (error) {
		next(error)
	}
}

// 즐겨찾기 추가, 수정, 삭제 API 요청 처리
export async function addFavorite(req, res, next) {
	try {
		res.status(201).json({ success: true, data: await placesService.addFavorite(req.user.id, req.body) })
	} catch (error) {
		next(error)
	}
}

// 즐겨찾기 수정 API 요청 처리
export async function editFavorite(req, res, next) {
	try {
		res.json({ success: true, data: await placesService.editFavorite(req.user.id, req.params.favoriteId, req.body) })
	} catch (error) {
		next(error)
	}
}

// 즐겨찾기 삭제 API 요청 처리
export async function removeFavorite(req, res, next) {
	try {
		await placesService.removeFavorite(req.user.id, req.params.favoriteId)
		res.status(204).send()
	} catch (error) {
		next(error)
	}
}
