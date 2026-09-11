// # 기능: ADM-INQUIRY 문의사항 요청값 검증
// # 역할:
// - inquiryId 검증
// - 문의 상태값 검증
// - 관리자 답변 내용 검증
// - PATCH 요청 형식 검증


const ALLOWED_STATUS = [
    'received',
    'in_review',
    'answered',
]


// =========================================================
// 공통 Validation Error
// =========================================================

function createValidationError(
    message,
    code = 'INVALID_INQUIRY_INPUT'
) {
    const error = new Error(message)

    error.status = 400
    error.code = code

    return error
}


// =========================================================
// inquiryId 검증
// =========================================================

export function validateInquiryId(
    req,
    res,
    next
) {
    try {
        const inquiryId =
            req.params.inquiryId
        
        const uuidPattern = /^[0-9a-fA-F]{8}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i

        if (
            !inquiryId ||
            !uuidPattern.test(inquiryId)
        ) {
            throw createValidationError(
                '올바른 문의사항 ID를 입력해주세요.',
                'INVALID_INQUIRY_ID'
            )
        }

        next()
    } catch (error) {
        next(error)
    }
}


// =========================================================
// 문의 수정 검증
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
//     "answerContent": "답변 내용"
// }
// =========================================================

export function validateUpdateInquiry(
    req,
    res,
    next
) {
    try {
        const {
            status,
            answerContent,
        } = req.body


        // -------------------------------------------------
        // 아무 값도 없는 경우
        // -------------------------------------------------

        if (
            status === undefined &&
            answerContent === undefined
        ) {
            throw createValidationError(
                '수정할 문의사항 정보를 입력해주세요.'
            )
        }


        // -------------------------------------------------
        // status + answerContent 동시에 전달 금지
        // -------------------------------------------------

        if (
            status !== undefined &&
            answerContent !== undefined
        ) {
            throw createValidationError(
                '문의 상태 변경과 답변 등록은 동시에 처리할 수 없습니다.'
            )
        }


        // -------------------------------------------------
        // 상태 변경 검증
        // -------------------------------------------------

        if (status !== undefined) {
            if (
                typeof status !== 'string' ||
                !ALLOWED_STATUS.includes(status)
            ) {
                throw createValidationError(
                    '올바르지 않은 문의 상태입니다.',
                    'INVALID_INQUIRY_STATUS'
                )
            }


            /*
             * answered 상태는 답변 등록 시
             * service에서 자동 변경하기 때문에
             * status만 answered로 변경할 수 없음
             */
            if (status === 'answered') {
                throw createValidationError(
                    '답변완료 상태는 관리자 답변 등록 시 자동으로 변경됩니다.',
                    'ANSWER_REQUIRED'
                )
            }
        }


        // -------------------------------------------------
        // 답변 내용 검증
        // -------------------------------------------------

        if (answerContent !== undefined) {
            if (
                typeof answerContent !== 'string' ||
                !answerContent.trim()
            ) {
                throw createValidationError(
                    '문의 답변 내용을 입력해주세요.',
                    'ANSWER_CONTENT_REQUIRED'
                )
            }
        }


        next()
    } catch (error) {
        next(error)
    }
}