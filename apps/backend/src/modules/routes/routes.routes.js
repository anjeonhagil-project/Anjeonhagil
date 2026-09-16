// 수정 필요(Anjeonhagil): 검색/노출/최종선택 API를 추가하고 authenticate/requireActiveUser를 적용한다. 새 연결 준비 전 기존 directions 동작은 유지한다.
// 기능: ROUTE-001~006: 경로요청/Polling/선택/상세/Navigation/reroute endpoint URL/middleware 연결
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import * as routesController from './routes.controller.js'

const router = Router()

router.use(authenticate)

// 최단시간/최단거리 경로 조회
router.get('/directions', routesController.getDirections)

export default router
