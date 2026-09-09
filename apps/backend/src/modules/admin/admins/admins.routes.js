// # 기능: Super Admin 관리자 목록/생성/역할·상태 변경 endpoint URL/middleware 연결

import { Router } from 'express'

import { authenticate } from '../../../middleware/authenticate.js'
import { requireAdmin } from '../../../middleware/requireAdmin.js'
import { requireSuperAdmin } from '../../../middleware/requireSuperAdmin.js'

import {
    getAdmins,
    grantAdmin,
    updateAdmin,
    revokeAdmin,
} from './admins.controller.js'

const router = Router()


// 관리자 목록 조회
router.get(
    '/',
    authenticate,
    requireAdmin,
    requireSuperAdmin,
    getAdmins
)


// 관리자 권한 부여
router.post(
    '/',
    authenticate,
    requireAdmin,
    requireSuperAdmin,
    grantAdmin
)


// 관리자 역할 / 활성 상태 변경
router.patch(
    '/:adminId',
    authenticate,
    requireAdmin,
    requireSuperAdmin,
    updateAdmin
)


// 관리자 권한 회수
router.delete(
    '/:adminId',
    authenticate,
    requireAdmin,
    requireSuperAdmin,
    revokeAdmin
)


export default router