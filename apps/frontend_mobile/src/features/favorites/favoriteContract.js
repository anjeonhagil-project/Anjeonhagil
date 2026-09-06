export function buildCreateFavoritePayload(place) {
	return {
		placeType: place.placeType,
		placeName: place.placeName,
		customName: place.customName,
		address: place.address,
		latitude: place.latitude,
		longitude: place.longitude,
		...(place.providerPlaceId ? { providerPlaceId: place.providerPlaceId } : {}),
	}
}

export function buildFavoriteLocationSelection({ favoriteId, placeType = 'custom', draftName }) {
	return {
		to: '/home',
		state: {
			...(favoriteId ? { editingFavoriteId: favoriteId } : {}),
			placeType,
			...(draftName !== undefined ? { draftName } : {}),
		},
	}
}

export function toFavoriteMarkerLocations(favorites = []) {
	return favorites
		.filter((favorite) => Number.isFinite(favorite.latitude) && Number.isFinite(favorite.longitude))
		.map((favorite) => ({
			id: favorite.id,
			title: favorite.customName?.trim() || favorite.placeName,
			latitude: favorite.latitude,
			longitude: favorite.longitude,
		}))
}
