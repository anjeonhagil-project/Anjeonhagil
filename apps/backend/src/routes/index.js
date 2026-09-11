// 기능: 모든 자체 endpoint를 `/api` 아래 연결
// 주의: `/api/v1`은 현재 FINAL에서 사용하지 않음
import { Router } from 'express'
import usersRouter from '../modules/users/users.routes.js'
import authRouter from '../modules/auth/auth.routes.js'
import preferencesRouter from '../modules/preferences/preferences.routes.js'
import placesRouter from '../modules/places/places.routes.js'
import routesRouter from '../modules/routes/routes.routes.js'

import adminUsersRouter from '../modules/admin/users/users.routes.js'
import adminAdminsRouter from '../modules/admin/admins/admins.routes.js'
import adminInquiriesRouter from '../modules/admin/inquiries/inquiries.routes.js'

import adminNoticesRouter from '../modules/admin/notices/notices.routes.js'

import { authenticate } from '../middleware/authenticate.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { getCurrentAdmin } from '../modules/admin/admins/admins.controller.js'


const router = Router()

router.use('/users', usersRouter)
router.use('/auth', authRouter)
router.use('/driving-preferences', preferencesRouter)
router.use('/', placesRouter)
router.use('/routes', routesRouter)

router.use('/admin/users', adminUsersRouter)
router.use('/admin/notices', adminNoticesRouter)
router.get('/admin/me', authenticate, requireAdmin, getCurrentAdmin)

router.use('/admin/inquiries', adminInquiriesRouter)


export default router
