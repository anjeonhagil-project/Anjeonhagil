// 기능: ROUTE-001~006: 경로요청/Polling/선택/상세/Navigation/reroute endpoint URL/middleware 연결
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { requireActiveUser } from '../../middleware/requireActiveUser.js'
import * as routesController from './routes.controller.js'

const router = Router()

router.use(authenticate, requireActiveUser)

// 최단시간/최단거리 경로 조회
router.post('/searches', routesController.search)
router.get('/searches', routesController.history)
router.get('/searches/:searchId', routesController.detail)
router.get('/searches/:searchId/guidance', routesController.guidance)
router.post('/searches/:searchId/exposures', routesController.recordExposure)
router.post('/exposures/:exposureId/choices', routesController.recordChoice)

export default router
