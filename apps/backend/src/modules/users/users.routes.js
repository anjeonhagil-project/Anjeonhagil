// 기능: USER-001~004: 가입 완료/내정보/프로필수정/탈퇴 endpoint URL/middleware 연결
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import * as usersController from './users.controller.js'

const router = Router()

// 내 정보 조회
router.get('/me', authenticate, usersController.getMe)

// 약관 동의 상태 조회
router.get('/me/terms', authenticate, usersController.getTerms)

// 약관 동의 저장
router.put('/me/terms', authenticate, usersController.updateTerms)

export default router