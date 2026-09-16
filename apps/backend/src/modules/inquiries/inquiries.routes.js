// # 기능: INQ-001~003: 사용자 문의 등록/내 문의 목록/상세 endpoint 연결
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import {
    createInquiry,
    getMyInquiries,
    getMyInquiryById,
} from './inquiries.controller.js'
import {
    validateCreateInquiry,
    validateInquiryId,
} from './inquiries.validation.js'

const router = Router()

// 문의는 로그인한 사용자 본인만 작성·조회한다.
router.use(authenticate)

router.post('/', validateCreateInquiry, createInquiry)
router.get('/me', getMyInquiries)
router.get('/:inquiryId', validateInquiryId, getMyInquiryById)

export default router
