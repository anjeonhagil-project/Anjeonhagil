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

export function buildFavoriteLocationResult({ selectedPlace, favoriteId, placeType = 'custom', draftName }) {
	return {
		to: favoriteId ? `/favorites/${favoriteId}` : '/favorites',
		replace: Boolean(favoriteId),
		state: {
			selectedPlace,
			placeType,
			...(draftName !== undefined ? { draftName } : {}),
		},
	}
}

const FAVORITE_MARKER_TYPES = new Set(['home', 'work', 'custom'])

const FAVORITE_MARKER_APPEARANCE = {
	home: {
		color: '#6556D8',
		glyph: '<path fill="white" d="M9.5 18 18 10.5 26.5 18v8.5h-5.7v-5.8h-5.6v5.8H9.5Z"/>',
	},
	work: {
		color: '#4F67D7',
		glyph: '<path fill="white" d="M10.5 12h15v15h-15Zm3 3v2h2v-2Zm4.5 0v2h2v-2Zm4.5 0v2h2v-2Zm-9 4v2h2v-2Zm4.5 0v2h2v-2Zm4.5 0v2h2v-2Zm-4.5 4v4h2v-4Z"/>',
	},
	custom: {
		color: '#F05B78',
		glyph: '<path fill="white" d="M18 27.2 10.7 20C7 16.3 8.9 10.2 13.7 10.2c2.1 0 3.6 1.2 4.3 2.1.7-.9 2.2-2.1 4.3-2.1 4.8 0 6.7 6.1 3 9.8Z"/>',
	},
}

function normalizeFavoriteMarkerType(placeType) {
	return FAVORITE_MARKER_TYPES.has(placeType) ? placeType : 'custom'
}

function buildFavoriteMarkerSource(placeType) {
	const markerType = normalizeFavoriteMarkerType(placeType)
	const { color, glyph } = FAVORITE_MARKER_APPEARANCE[markerType]
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42" data-icon="${markerType}"><ellipse cx="18" cy="39.5" rx="6" ry="1.5" fill="#111827" opacity=".18"/><path fill="${color}" stroke="white" stroke-width="2.5" d="M18 1.5A15.5 15.5 0 0 0 2.5 17c0 10.8 12.6 20.4 15.5 23 2.9-2.6 15.5-12.2 15.5-23A15.5 15.5 0 0 0 18 1.5Z"/>${glyph}</svg>`
	return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function createFavoriteMarkerImage(kakao, placeType) {
	return new kakao.maps.MarkerImage(
		buildFavoriteMarkerSource(placeType),
		new kakao.maps.Size(36, 42),
		{ offset: new kakao.maps.Point(18, 42) },
	)
}

export function findFavoriteForPlace(favorites = [], place) {
	if (!Number.isFinite(place?.latitude) || !Number.isFinite(place?.longitude)) return null

	return favorites.find((favorite) => (
		Number.isFinite(favorite.latitude)
		&& Number.isFinite(favorite.longitude)
		&& Math.abs(favorite.latitude - place.latitude) < 0.000001
		&& Math.abs(favorite.longitude - place.longitude) < 0.000001
	)) ?? null
}

export function toFavoriteMarkerLocations(favorites = []) {
	return favorites
		.filter((favorite) => Number.isFinite(favorite.latitude) && Number.isFinite(favorite.longitude))
		.map((favorite) => ({
			id: favorite.id,
			title: favorite.customName?.trim() || favorite.placeName,
			placeName: favorite.placeName,
			address: favorite.address,
			placeType: normalizeFavoriteMarkerType(favorite.placeType),
			latitude: favorite.latitude,
			longitude: favorite.longitude,
		}))
}
