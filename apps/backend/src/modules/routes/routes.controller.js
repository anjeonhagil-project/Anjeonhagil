// 기능: ROUTE-001~006: 경로요청/Polling/선택/상세/Navigation/reroute HTTP req/res 처리
import * as routesService from './routes.service.js'
import { validateChoiceInput, validateSearchInput, validateExposureInput, requireUuid } from './routes.validation.js'

// 최단시간/최단거리 경로 조회
export async function search(req, res, next) {
    try {
        const params = validateSearchInput(req.body)
        res.json({ success: true, data: await routesService.search(req.user.id,params) })
    } catch (error) {
        next(error)
    }
}

export async function detail(req,res,next) {
    try {res.json({success:true,data:await routesService.detail(req.user.id,requireUuid(req.params.searchId,'검색'))})} catch(error) {next(error)}
}
export async function history(req,res,next) {
    try {res.json({success:true,data:await routesService.history(req.user.id)})} catch(error) {next(error)}
}

// Only the authenticated user's saved selection is used; no client supplied arcs.
export async function guidance(req,res,next) {
    try {res.json({success:true,data:await routesService.guidance(req.user.id,requireUuid(req.params.searchId,'검색'))})} catch(error) {next(error)}
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
