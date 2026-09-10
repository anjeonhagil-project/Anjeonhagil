// # 기능: ADM-INQUIRY 관리자 문의사항 API route
// # 인증된 관리자만 접근 가능

import { Router } from 'express'

import {
    authenticate,
} from '../../../middleware/authenticate.js'

import {
    requireAdmin,
} from '../../../middleware/requireAdmin.js'

import {
    getInquiries,
    getInquiryById,
    updateInquiry,
} from './inquiries.controller.js'

import {
    validateInquiryId,
    validateUpdateInquiry,
} from './inquiries.validation.js'


const router = Router()


// =========================================================
// 문의사항 목록 조회
//
// GET /api/admin/inquiries
//
// query:
// ?search=
// ?status=received
// ?category=
// ?page=1
// ?size=10
// ?sortOrder=desc
// =========================================================

router.get(
    '/',
    authenticate,
    requireAdmin,
    getInquiries
)


// =========================================================
// 문의사항 상세 조회
//
// GET /api/admin/inquiries/:inquiryId
// =========================================================

router.get(
    '/:inquiryId',
    authenticate,
    requireAdmin,
    validateInquiryId,
    getInquiryById
)


// =========================================================
// 문의 상태 변경 / 관리자 답변 등록
//
// PATCH /api/admin/inquiries/:inquiryId
//
// 상태 변경:
// {
//     "status": "in_review"
// }
//
// 답변 등록:
// {
//     "answerContent": "관리자 답변"
// }
// =========================================================

router.patch(
    '/:inquiryId',
    authenticate,
    requireAdmin,
    validateInquiryId,
    validateUpdateInquiry,
    updateInquiry
)


export default router