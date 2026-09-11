// # 기능: NOTICE-001~002: 사용자 공지 목록/상세 입력 검증 schema
export function validateNoticeId(req, res, next) {
    const noticeId = Number(req.params.noticeId)

    if (!Number.isSafeInteger(noticeId) || noticeId < 1) {
        const error = new Error('올바른 공지사항 ID가 아닙니다')
        error.status = 400
        error.code = 'INVALID_NOTICE_ID'
        return next(error)
    }

    next()
}
