// # 기능: INQ-001~003: 사용자 문의 등록/목록/상세 HTTP req/res 처리
import * as inquiriesService from './inquiries.service.js'

// 문의 등록: user_id는 요청 본문이 아니라 인증 토큰에서만 가져온다.
export async function createInquiry(req, res, next) {
    try {
        const inquiry = await inquiriesService.createInquiry(req.user.id, req.body)
        res.status(201).json({ success: true, data: inquiry })
    } catch (error) {
        next(error)
    }
}

// 내 문의 목록 조회
export async function getMyInquiries(req, res, next) {
    try {
        const result = await inquiriesService.listMyInquiries(req.user.id, {
            page: req.query.page,
            limit: req.query.limit,
        })
        res.json({ success: true, data: result })
    } catch (error) {
        next(error)
    }
}

// 내 문의 상세와 관리자 답변 조회
export async function getMyInquiryById(req, res, next) {
    try {
        const inquiry = await inquiriesService.getMyInquiry(
            req.user.id,
            req.params.inquiryId
        )

        if (!inquiry) {
            const error = new Error('문의사항을 찾을 수 없습니다')
            error.status = 404
            error.code = 'INQUIRY_NOT_FOUND'
            throw error
        }

        res.json({ success: true, data: inquiry })
    } catch (error) {
        next(error)
    }
}
