// 수정 필요(Anjeonhagil): 원본 /search는 ranks만 사용하므로 learned 프로필 연결 시 tools/profile_adapter.py 구현과 응답 profile_weights 일치 검사를 추가한다. URL/시간 초과/비JSON 오류 처리도 연결한다.
// 기능: Express에서 Anjeonhagil Python 계산기를 호출하는 내부 클라이언트. routes.service.js에 연결하기 전까지 현재 카카오 경로 기능에는 영향이 없다.
import { VERSIONS } from './routingContract.js'

export async function searchRoutes(input, { fetchImpl = fetch } = {}) {
    const response = await fetchImpl(`${process.env.ROUTING_WORKER_URL || 'http://127.0.0.1:8100'}/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(process.env.ROUTING_WORKER_TOKEN ? { Authorization: `Bearer ${process.env.ROUTING_WORKER_TOKEN}` } : {}),
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(150000),
    })
    const result = await response.json()
    if (!response.ok) {
        const error = new Error(result.error || '경로 계산에 실패했습니다')
        error.status = response.status === 422 ? 422 : 503
        throw error
    }
    for (const [key, version] of Object.entries(VERSIONS)) {
        if (result[key] !== version) {
            const error = new Error(`경로 계산 버전이 다릅니다: ${key}`)
            error.status = 503
            throw error
        }
    }
    return result
}
