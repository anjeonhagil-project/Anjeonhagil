// 기능(Anjeonhagil): 인증된 활성 사용자의 Q1~Q3 설문 조회·저장 endpoint를 연결한다.
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import * as preferencesController from './preferences.controller.js'
import { validateDrivingPreferences } from './preferences.validation.js'
// 회원 탈퇴로 인한 온보딩 삭제
import { requireActiveUser } from '../../middleware/requireActiveUser.js'

const router = Router()

router.use(authenticate, requireActiveUser)

router
    .route('/')
    .get(preferencesController.getDrivingPreferences)
    .put(validateDrivingPreferences, preferencesController.saveDrivingPreferences)

export default router
