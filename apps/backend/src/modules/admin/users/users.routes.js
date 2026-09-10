// # 기능: ADM-USER: 회원 목록/상세 endpoint URL/middleware 연결

import { Router } from 'express'

import { authenticate } from '../../../middleware/authenticate.js'
import { requireAdmin } from '../../../middleware/requireAdmin.js'

import {
    getUsers,
    getUserById,
} from './users.controller.js'

const router = Router()

// 관리자 회원 목록 조회
router.get(
    '/',
    authenticate,
    requireAdmin,
    getUsers
)

// 관리자 회원 상세 조회
router.get(
    '/:userId',
    authenticate,
    requireAdmin,
    getUserById
)

export default router