// 기능: ROUTE-001~006: 경로요청/Polling/선택/상세/Navigation/reroute 비즈니스 규칙/transaction
const KAKAO_DIRECTIONS_URL = 'https://apis-navi.kakaomobility.com/v1/directions'

// roads[].vertexes([x1,y1,x2,y2,...])를 이어붙여 {lat,lng} 좌표 목록으로 변환
function toPath(sections) {
    const path = []
    for (const section of sections) {
        for (const road of section.roads) {
            for (let i = 0; i < road.vertexes.length; i += 2) {
                path.push({ lat: road.vertexes[i + 1], lng: road.vertexes[i] })
            }
        }
    }
    return path
}

// 카카오모빌리티 자동차 길찾기 API를 호출해 priority(TIME/DISTANCE) 기준 경로 하나를 계산
async function fetchDirections(origin, destination, priority) {
    const url = new URL(KAKAO_DIRECTIONS_URL)
    url.searchParams.set('origin', `${origin.lng},${origin.lat}`)   // (경도, 위도) 순으로 카카오에서 요구
    url.searchParams.set('destination', `${destination.lng},${destination.lat}`)
    url.searchParams.set('priority', priority)

    const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    })

    if (!response.ok) {
        const error = new Error('경로 계산 중 오류가 발생했습니다')
        error.status = 502
        throw error
    }

    // 카카오는 HTTP 상태는 200인데 응답 본문 안에서 실패를 알려주는 경우가 있어서 (예: 경로 자체를 못 찾음) result_code도 따로 확인
    const data = await response.json()
    const route = data.routes?.[0]
    if (!route || route.result_code !== 0) {
        const error = new Error(route?.result_msg || '경로를 찾을 수 없습니다')
        error.status = 404
        throw error
    }

    // 카카오의 원본 응답에서 필요한 것만 뽑아서 (distance, duration, path)로 변환하여 돌려줌
    return {
        distance: route.summary.distance,
        duration: route.summary.duration,
        path: toPath(route.sections),
    }
}

// 카카오모빌리티 자동차 길찾기 API로 최단시간/최단거리 경로를 동시에 계산
export async function getDirections({ origin, destination }) {
    const [shortestTime, shortestDistance] = await Promise.all([
        fetchDirections(origin, destination, 'TIME'),
        fetchDirections(origin, destination, 'DISTANCE'),
    ])

    return { shortestTime, shortestDistance }
}
