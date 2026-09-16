// # 기능: NOTICE-001~002: 사용자 공지 목록/상세 endpoint URL 연결
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { getNoticeById, getNotices } from './notices.controller.js'
import { validateNoticeId } from './notices.validation.js'

const router = Router()

// 마이페이지에서 게시된 공지만 읽을 수 있다. 작성/수정/삭제 route는 제공하지 않는다.
router.use(authenticate)
router.get('/', getNotices)
router.get('/:noticeId', validateNoticeId, getNoticeById)

export default router
