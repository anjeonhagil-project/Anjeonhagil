const PLACE_TYPES = new Set(['home', 'work', 'custom'])

// 즐겨찾기 추가·수정 요청의 입력값 검증
export function validateFavoritePayload(payload = {}, { partial = false } = {}) {
	const errors = {}

	if (!partial || payload.placeType !== undefined) {
		if (!PLACE_TYPES.has(payload.placeType)) errors.placeType = 'placeType은 home, work, custom 중 하나여야 합니다'
	}
	if (!partial || payload.placeName !== undefined) {
		if (typeof payload.placeName !== 'string' || payload.placeName.trim().length === 0 || payload.placeName.length > 200) {
			errors.placeName = 'placeName은 1~200자로 입력해주세요'
		}
	}
	if (payload.customName !== undefined && payload.customName !== null) {
		if (typeof payload.customName !== 'string' || payload.customName.length > 100) {
			errors.customName = 'customName은 100자 이하로 입력해주세요'
		}
	}
	if (!partial || payload.address !== undefined) {
		if (typeof payload.address !== 'string' || payload.address.trim().length === 0) {
			errors.address = 'address를 입력해주세요'
		}
	}
	if (!partial || payload.geom !== undefined) {
		const coordinates = payload.geom?.coordinates
		if (payload.geom?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2 ||
			coordinates.some((value) => typeof value !== 'number')) {
			errors.geom = 'geom은 GeoJSON Point 형식이어야 합니다'
		}
	}

	if (Object.keys(errors).length > 0) {
		const error = new Error('입력값을 확인해주세요')
		error.status = 400
		error.details = errors
		throw error
	}
}
