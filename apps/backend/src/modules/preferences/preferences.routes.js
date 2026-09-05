// 기능: PREF-001~002: 운전부담 설정 조회/Upsert endpoint URL/middleware 연결
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import * as preferencesController from './preferences.controller.js'
import { validateDrivingPreferences } from './preferences.validation.js'

const router = Router()

router.use(authenticate)

router
    .route('/')
    .get(preferencesController.getDrivingPreferences)
    .put(validateDrivingPreferences, preferencesController.saveDrivingPreferences)

export default router
