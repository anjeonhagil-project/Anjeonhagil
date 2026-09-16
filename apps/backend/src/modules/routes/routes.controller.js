// 수정 필요(Anjeonhagil): 인증 사용자로 검색·노출·선택을 호출하고 클라이언트 user_id/피처/버전을 신뢰하지 않는다. Q4 요청 출처는 서버에서 결정한다.
// 기능: ROUTE-001~006: 경로요청/Polling/선택/상세/Navigation/reroute HTTP req/res 처리
import * as routesService from './routes.service.js'
import { validateChoiceInput, validateDirectionsQuery, validateExposureInput } from './routes.validation.js'

// 최단시간/최단거리 경로 조회
export async function getDirections(req, res, next) {
    try {
        const params = validateDirectionsQuery(req.query)
        res.json({ success: true, data: await routesService.getDirections(params) })
    } catch (error) {
        next(error)
    }
}

export async function recordExposure(req, res, next) {
    try {
        const input = validateExposureInput(req.params.searchId, req.body)
        res.status(201).json({ success: true, data: await routesService.recordExposure(req.user.id, input) })
    } catch (error) {
        next(error)
    }
}

export async function recordChoice(req, res, next) {
    try {
        const input = validateChoiceInput(req.params.exposureId, req.body)
        res.status(201).json({ success: true, data: await routesService.recordChoice(req.user.id, input) })
    } catch (error) {
        next(error)
    }
}
