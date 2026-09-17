// 로컬 SQLite 계산기 전용 HTTP 통신. 데이터 버전과 오류를 확인한다.
import { VERSIONS } from './routingContract.js'
export async function callWorker(endpoint, input, { fetchImpl = fetch, timeout = 45000, signal } = {}) {
    let response, result
    try {
        response = await fetchImpl((process.env.ROUTING_WORKER_URL || 'http://127.0.0.1:8100') + endpoint, {
            method: input === undefined ? 'GET' : 'POST',
            headers: { 'Content-Type':'application/json', ...(process.env.ROUTING_WORKER_TOKEN ? {Authorization:'Bearer '+process.env.ROUTING_WORKER_TOKEN} : {}) },
            body:input===undefined?undefined:JSON.stringify(input), signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout),
        })
        result=await response.json()
    } catch {
        signal?.throwIfAborted()
        throw Object.assign(new Error('경로 계산기에 연결할 수 없습니다. 로컬 실행 상태를 확인해주세요.'),{status:503,code:'ROUTING_UNAVAILABLE',expose:true})
    }
    if(!response.ok) {
        const messages={OUTSIDE_SEOUL_SERVICE_AREA:'현재 서울 안의 출발지·도착지만 지원합니다.',NO_SUPPORTED_ROAD_WITHIN_40M:'선택 위치에서 40m 이내에 지원 도로가 없습니다. 가까운 도로 위 위치를 선택해주세요.',NO_DIRECTION_MATCH_AT_SNAP:'현재 진행 방향으로 연결할 도로를 찾지 못했습니다. 안전한 곳에서 위치와 방향을 확인하고 다시 검색해주세요.',ORIGIN_DESTINATION_TOO_CLOSE:'출발지와 도착지가 너무 가깝습니다.',NO_VERIFIED_ROUTE_WITHIN_TIME_LIMIT:'제한 시간 안에 경로를 찾지 못했습니다. 가까운 구간으로 다시 검색해주세요.',BURDEN_EXPLANATION_MISMATCH:'부담 구간 검산에 실패했습니다. 다시 검색해주세요.'}
        throw Object.assign(new Error(messages[result.error]||'경로를 계산하지 못했습니다. 출발지와 도착지를 다시 확인해주세요.'),{status:response.status===422?422:503,code:messages[result.error]?result.error:'ROUTING_FAILED',expose:true})
    }
    return result
}
export async function searchRoutes(input, options) {
    const result=await callWorker('/search',input,options)
    for(const [key,version] of Object.entries(VERSIONS)) {
        if(result[key]!==version) throw Object.assign(new Error('경로 데이터 버전이 일치하지 않습니다'),{status:503,code:'ROUTING_VERSION_MISMATCH'})
    }
    return result
}
