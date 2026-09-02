// # 기능: 회원가입 중복확인 endpoint 연결 (비로그인 공개 API)
import { Router } from 'express'
import * as authController from './auth.controller.js'

const router = Router()

// 회원가입 시 아이디 중복 확인용
router.get('/check-username', authController.checkUsername)

// 회원가입 시 이메일 중복 확인용
router.get('/check-email', authController.checkEmail)

export default router
