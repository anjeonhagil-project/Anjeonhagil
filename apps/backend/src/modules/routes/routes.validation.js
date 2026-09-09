// 기능: ROUTE-001~006: 경로요청/Polling/선택/상세/Navigation/reroute 입력 검증 schema

function parseCoordinate(value, label) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        const error = new Error(`${label} 좌표가 올바르지 않습니다`)
        error.status = 400
        throw error
    }
    return parsed
}

// 최단시간/최단거리 조회 시 출발지/도착지 쿼리 검증
export function validateDirectionsQuery(query) {
    return {
        origin: {
            lat: parseCoordinate(query.originLat, '출발지 위도'),
            lng: parseCoordinate(query.originLng, '출발지 경도'),
        },
        destination: {
            lat: parseCoordinate(query.destinationLat, '도착지 위도'),
            lng: parseCoordinate(query.destinationLng, '도착지 경도'),
        },
    }
}
