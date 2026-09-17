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

// 일반 장소 → 이름 + 주소 + 좌표가 있어야 경로 검색 가능

export function toCurrentLocation(position) {
    return {
        placeName: '현재 위치',
        address: '',
        latitude: position.lat,
        longitude: position.lng,
        source: 'current-location',
        accuracy: position.accuracy,
    }
}

// 현재 위치 → 주소가 없어도 GPS 좌표만 정상이면 경로 검색 가능

export function hasRouteLocation(place) {
    const hasCoordinates = Number.isFinite(place?.latitude)
        && Math.abs(place.latitude) <= 90
        && Number.isFinite(place?.longitude)
        && Math.abs(place.longitude) <= 180

    return hasCoordinates && (
        hasSelectedLocation(place)
        || place?.source === 'current-location'
    )
}

export function buildSafeRouteSearchState(destination) {
    return { destination }
}

export function buildRouteSearchFields(destination) {
    return {
        origin: { text: '', place: null },
        destination: hasSelectedLocation(destination)
            ? { text: destination.placeName, place: destination }
            : { text: '', place: null },
    }
}
