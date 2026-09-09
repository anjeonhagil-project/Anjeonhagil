// 기능: ROUTE-001~006: 경로요청/Polling/선택/상세/Navigation/reroute HTTP req/res 처리
import * as routesService from './routes.service.js'
import { validateDirectionsQuery } from './routes.validation.js'

// 최단시간/최단거리 경로 조회
export async function getDirections(req, res, next) {
    try {
        const params = validateDirectionsQuery(req.query)
        res.json({ success: true, data: await routesService.getDirections(params) })
    } catch (error) {
        next(error)
    }
}
