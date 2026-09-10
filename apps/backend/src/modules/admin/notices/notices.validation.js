// # 기능: ADM-NOTICE 공지사항 요청값 검증


// 공통 에러 생성
function createValidationError(message) {
    const error = new Error(message)

    error.status = 400
    error.code = 'INVALID_NOTICE_INPUT'

    return error
}


// 공지사항 등록 검증
export function validateCreateNotice(req, res, next) {
    try {
        const {
            title,
            content,
            isPublished,
        } = req.body

        if (
            typeof title !== 'string' ||
            !title.trim()
        ) {
            throw createValidationError(
                '공지사항 제목을 입력해주세요.'
            )
        }

        if (title.trim().length > 200) {
            throw createValidationError(
                '공지사항 제목은 200자 이하로 입력해주세요.'
            )
        }

        if (
            typeof content !== 'string' ||
            !content.trim()
        ) {
            throw createValidationError(
                '공지사항 내용을 입력해주세요.'
            )
        }

        if (
            isPublished !== undefined &&
            typeof isPublished !== 'boolean'
        ) {
            throw createValidationError(
                '노출 상태 값이 올바르지 않습니다.'
            )
        }

        next()
    } catch (err) {
        next(err)
    }
}


// 공지사항 수정 검증
export function validateUpdateNotice(req, res, next) {
    try {
        const {
            title,
            content,
            isPublished,
        } = req.body

        // 수정할 값이 하나도 없는 경우
        if (
            title === undefined &&
            content === undefined &&
            isPublished === undefined
        ) {
            throw createValidationError(
                '수정할 내용을 입력해주세요.'
            )
        }

        if (title !== undefined) {
            if (
                typeof title !== 'string' ||
                !title.trim()
            ) {
                throw createValidationError(
                    '공지사항 제목을 입력해주세요.'
                )
            }

            if (title.trim().length > 200) {
                throw createValidationError(
                    '공지사항 제목은 200자 이하로 입력해주세요.'
                )
            }
        }

        if (content !== undefined) {
            if (
                typeof content !== 'string' ||
                !content.trim()
            ) {
                throw createValidationError(
                    '공지사항 내용을 입력해주세요.'
                )
            }
        }

        if (
            isPublished !== undefined &&
            typeof isPublished !== 'boolean'
        ) {
            throw createValidationError(
                '노출 상태 값이 올바르지 않습니다.'
            )
        }

        next()
    } catch (err) {
        next(err)
    }
}