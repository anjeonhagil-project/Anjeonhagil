export function assertFavoriteOwnership(favorite, userId) {
	if (!favorite) {
		const error = new Error('즐겨찾기를 찾을 수 없습니다')
		error.status = 404
		throw error
	}

	if (favorite.user_id !== userId) {
		const error = new Error('본인의 즐겨찾기만 변경할 수 있습니다')
		error.status = 403
		error.code = 'NOT_OWNER'
		throw error
	}
}
