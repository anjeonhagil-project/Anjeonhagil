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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function requireUuid(value, label) {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
        const error = new Error(`${label} 식별자가 올바르지 않습니다`)
        error.status = 400
        error.code = 'INVALID_ROUTE_EVENT'
        throw error
    }
    return value
}

export function validateSearchInput(body) {
    const invalid=()=>{throw Object.assign(new Error('출발지·도착지·출발시각을 확인해주세요'),{status:400,code:'INVALID_ROUTE_REQUEST'})}
    if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!['searchId','origin','destination','departureAt'].includes(k))) invalid()
    const point=(p)=>{
        if(!p || typeof p!=='object' || ![p.lat,p.lng].every(v=>typeof v==='number' && Number.isFinite(v)) || Math.abs(p.lat)>90 || Math.abs(p.lng)>180) invalid()
        if(p.heading!==undefined&&(!Number.isFinite(p.heading)||p.heading<0||p.heading>=360))invalid()
        return {lat:p.lat,lng:p.lng,...(p.heading!==undefined?{heading:p.heading}:{}),...(typeof p.name==='string'?{name:p.name.trim().slice(0,100)}:{})}
    }
    if(typeof body.departureAt!=='string'||!/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(body.departureAt)||!Number.isFinite(Date.parse(body.departureAt))) invalid()
    return {searchId:requireUuid(body.searchId,'검색'),origin:point(body.origin),destination:point(body.destination),departureAt:body.departureAt}
}

export function validateExposureInput(searchId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        const error = new Error('노출 정보를 입력해주세요')
        error.status = 400
        throw error
    }
    if (!Array.isArray(body.candidateIds) || body.candidateIds.length < 1 || body.candidateIds.length > 12) {
        const error = new Error('실제로 표시한 후보를 1개 이상 입력해주세요')
        error.status = 400
        throw error
    }

    const candidateIds = body.candidateIds.map((id) => requireUuid(id, '후보'))
    if (new Set(candidateIds).size !== candidateIds.length) {
        const error = new Error('같은 후보를 중복 노출할 수 없습니다')
        error.status = 400
        throw error
    }

    const recommendedCandidateId = body.recommendedCandidateId == null
        ? null
        : requireUuid(body.recommendedCandidateId, '추천 후보')
    if (recommendedCandidateId && !candidateIds.includes(recommendedCandidateId)) {
        const error = new Error('추천 후보는 실제 표시한 후보에 포함되어야 합니다')
        error.status = 400
        throw error
    }

    return {
        searchId: requireUuid(searchId, '검색'),
        exposureId: requireUuid(body.exposureId, '노출'),
        candidateIds,
        recommendedCandidateId,
    }
}

export function validateChoiceInput(exposureId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        const error = new Error('선택 정보를 입력해주세요')
        error.status = 400
        throw error
    }
    return {
        exposureId: requireUuid(exposureId, '노출'),
        choiceEventId: requireUuid(body.choiceEventId, '선택 이벤트'),
        selectedCandidateId: requireUuid(body.selectedCandidateId, '선택 후보'),
    }
}
