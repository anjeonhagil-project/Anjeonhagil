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
	if (!partial || payload.latitude !== undefined) {
		if (!Number.isFinite(payload.latitude) || Math.abs(payload.latitude) > 90) errors.latitude = 'latitude는 -90~90 사이의 숫자여야 합니다'
	}
	if (!partial || payload.longitude !== undefined) {
		if (!Number.isFinite(payload.longitude) || Math.abs(payload.longitude) > 180) errors.longitude = 'longitude는 -180~180 사이의 숫자여야 합니다'
	}
	if (payload.providerPlaceId !== undefined && payload.providerPlaceId !== null && typeof payload.providerPlaceId !== 'string') {
		errors.providerPlaceId = 'providerPlaceId는 문자열이어야 합니다'
	}

	// 위치를 바꿀 때는 지도에서 선택한 장소명·주소·좌표를 함께 갱신합니다.
	const locationFields = ['placeName', 'address', 'latitude', 'longitude']
	if (partial && locationFields.some((field) => payload[field] !== undefined)) {
		for (const field of locationFields) {
			if (payload[field] === undefined) errors[field] = '위치 변경 시 장소명, 주소, 좌표를 함께 보내주세요'
		}
	}

	if (Object.keys(errors).length > 0) {
		const error = new Error('입력값을 확인해주세요')
		error.status = 400
		error.code = 'VALIDATION_ERROR'
		error.details = errors
		throw error
	}
}
