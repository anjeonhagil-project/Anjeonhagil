// # 기능: INQ-001~003: 사용자 문의 등록/목록/상세 입력 검증 schema
function validationError(message, code = 'INVALID_INQUIRY_INPUT') {
    const error = new Error(message)
    error.status = 400
    error.code = code
    return error
}

export function validateCreateInquiry(req, res, next) {
    const { title, content } = req.body ?? {}

    if (typeof title !== 'string' || !title.trim()) {
        return next(validationError('문의 제목을 입력해주세요'))
    }

    if (title.trim().length > 200) {
        return next(validationError('문의 제목은 200자 이하로 입력해주세요'))
    }

    if (typeof content !== 'string' || !content.trim()) {
        return next(validationError('문의 내용을 입력해주세요'))
    }

    next()
}

export function validateInquiryId(req, res, next) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (!uuidPattern.test(req.params.inquiryId ?? '')) {
        return next(validationError('올바른 문의사항 ID가 아닙니다', 'INVALID_INQUIRY_ID'))
    }

    next()
}
