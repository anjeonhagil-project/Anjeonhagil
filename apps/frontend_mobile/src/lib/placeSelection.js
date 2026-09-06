// Kakao Local의 x는 경도, y는 위도입니다.
export function toSelectedPlace(place) {
    return {
        placeName: place.place_name,
        address: place.road_address_name || place.address_name || '',
        longitude: Number(place.x),
        latitude: Number(place.y),
        providerPlaceId: place.id || undefined,
    }
}

export function hasSelectedLocation(place) {
    return Boolean(place?.placeName?.trim() && place?.address?.trim()
        && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90
        && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180)
}
