export function toFavoriteResponse(favorite) {
	const coordinates = favorite.geom?.coordinates ?? []

	return {
		id: favorite.id,
		placeType: favorite.place_type,
		placeName: favorite.place_name,
		customName: favorite.custom_name,
		address: favorite.address,
		latitude: coordinates[1] ?? null,
		longitude: coordinates[0] ?? null,
	}
}
