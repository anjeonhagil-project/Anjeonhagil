// # 기능: ADM-NOTICE 공지사항 관리자 API route
// # 인증된 관리자만 접근 가능

import { Router } from 'express'

import { authenticate } from '../../../middleware/authenticate.js'
import { requireAdmin } from '../../../middleware/requireAdmin.js'

import {
    getNotices,
    getNoticeById,
    createNotice,
    updateNotice,
    deleteNotice,
} from './notices.controller.js'

import { validateCreateNotice, validateUpdateNotice } from './notices.validation.js'


const router = Router()


// 공지사항 목록 조회
router.get(
    '/',
    authenticate,
    requireAdmin,
    getNotices
)


// 공지사항 상세 조회
router.get(
    '/:noticeId',
    authenticate,
    requireAdmin,
    getNoticeById
)


// 공지사항 등록
router.post(
    '/',
    authenticate,
    requireAdmin,
    validateCreateNotice,
    createNotice
)


// 공지사항 수정
router.patch(
    '/:noticeId',
    authenticate,
    requireAdmin,
    validateUpdateNotice,
    updateNotice
)


// 공지사항 삭제
router.delete(
    '/:noticeId',
    authenticate,
    requireAdmin,
    deleteNotice
)


export default router