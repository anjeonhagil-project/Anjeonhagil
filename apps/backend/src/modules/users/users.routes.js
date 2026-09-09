// 기능: USER-001~004: 가입 완료/내정보/프로필수정/탈퇴 endpoint URL/middleware 연결
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import * as usersController from './users.controller.js'

// 회원 탈퇴로 인한 정보 삭제
import { requireActiveUser } from '../../middleware/requireActiveUser.js'


const router = Router()

// 탈퇴 계정도 복구 안내를 위해 상태 조회는 허용
router.get(
    '/me/account-status',
    authenticate,
    usersController.getAccountStatus
)


// 내 정보 조회
router.get('/me', authenticate, requireActiveUser, usersController.getMe)

// 약관 동의 상태 조회
router.get('/me/terms', authenticate, requireActiveUser, usersController.getTerms)

// 약관 동의 저장
router.put('/me/terms', authenticate, requireActiveUser, usersController.updateTerms)

// 마이페에지: 프로필 관리
router.patch('/me',authenticate, requireActiveUser, usersController.updateMe)

// 회원탈퇴
router.delete('/me', authenticate, requireActiveUser, usersController.withdrawMe)

// 탈퇴 후 30일 이내 계정 복구
router.patch('/me/restore', authenticate, usersController.restoreMe)
export default router