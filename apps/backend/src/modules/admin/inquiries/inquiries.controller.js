// # 기능: ADM-INQUIRY 관리자 문의사항 HTTP req/res 처리
// # 역할:
// - 문의 목록 조회
// - 문의 상세 조회
// - 문의 상태 변경
// - 관리자 답변 등록

import * as inquiriesService from './inquiries.service.js'


// =========================================================
// 문의사항 목록 조회
// GET /api/admin/inquiries
// =========================================================

export async function getInquiries(
    req,
    res,
    next
) {
    try {
        const result =
            await inquiriesService.listInquiries({
                search:
                    req.query.search?.trim() ||
                    '',

                status:
                    req.query.status,

                category:
                    req.query.category,

                page:
                    req.query.page ||
                    1,

                size:
                    req.query.size ||
                    10,

                sortOrder:
                    req.query.sortOrder ||
                    'desc',
            })


        res.json({
            success: true,
            data: result,
        })
    } catch (error) {
        next(error)
    }
}


// =========================================================
// 문의사항 상세 조회
// GET /api/admin/inquiries/:inquiryId
// =========================================================

export async function getInquiryById(
    req,
    res,
    next
) {
    try {
        const result =
            await inquiriesService.getInquiry(
                req.params.inquiryId
            )


        if (!result) {
            const error = new Error(
                '문의사항을 찾을 수 없습니다.'
            )

            error.status = 404
            error.code =
                'INQUIRY_NOT_FOUND'

            throw error
        }


        res.json({
            success: true,
            data: result,
        })
    } catch (error) {
        next(error)
    }
}


// =========================================================
// 문의사항 수정
//
// PATCH /api/admin/inquiries/:inquiryId
//
// 1) 상태 변경
// {
//     "status": "in_review"
// }
//
// 2) 관리자 답변 등록
// {
//     "answerContent": "관리자 답변입니다."
// }
// =========================================================

export async function updateInquiry(
    req,
    res,
    next
) {
    try {
        const {
            status,
            answerContent,
        } = req.body


        let result


        // -------------------------------------------------
        // 관리자 답변 등록
        // -------------------------------------------------

        if (answerContent !== undefined) {
            result =
                await inquiriesService
                    .submitInquiryAnswer(
                        req.params.inquiryId,
                        {
                            answerContent,

                            // requireAdmin에서 넣어준
                            // 현재 관리자 ID
                            answeredBy:
                                req.admin.id,
                        }
                    )
        }


        // -------------------------------------------------
        // 문의 상태 변경
        // -------------------------------------------------

        else if (status !== undefined) {
            result =
                await inquiriesService
                    .changeInquiryStatus(
                        req.params.inquiryId,
                        status
                    )
        }


        // -------------------------------------------------
        // 수정값 없음
        // -------------------------------------------------

        else {
            const error = new Error(
                '수정할 문의사항 정보를 입력해주세요.'
            )

            error.status = 400
            error.code =
                'INVALID_INQUIRY_INPUT'

            throw error
        }


        // -------------------------------------------------
        // 존재하지 않는 문의
        // -------------------------------------------------

        if (!result) {
            const error = new Error(
                '문의사항을 찾을 수 없습니다.'
            )

            error.status = 404
            error.code =
                'INQUIRY_NOT_FOUND'

            throw error
        }


        res.json({
            success: true,
            data: result,
        })
    } catch (error) {
        next(error)
    }
}