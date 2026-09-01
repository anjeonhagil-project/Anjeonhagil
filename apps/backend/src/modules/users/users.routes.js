// # 기능: USER-001~004: 가입 완료/내정보/프로필수정/탈퇴 endpoint URL/middleware 연결
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import * as usersController from './users.controller.js'

const router = Router()

router.get('/me', authenticate, usersController.getMe)

export default router