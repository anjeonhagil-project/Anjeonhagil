// 기능: PREF-001~002: 운전부담 설정 조회/Upsert 입력 검증 schema
const SCORE_FIELDS = [
    'intersectionScore',
    'pedestrianZoneScore',
    'narrowRoadScore',
    'turnConflictScore',
]

function badRequest(message) {
    const error = new Error(message)
    error.status = 400
    return error
}

// Q5는 삭제됐으므로 네 개의 원점수만 허용
export function validateDrivingPreferences(req, res, next) {
    const body = req.body

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return next(badRequest('운전 부담 설문 답변을 입력해주세요'))
    }

    const unknownFields = Object.keys(body).filter((field) => !SCORE_FIELDS.includes(field))
    if (unknownFields.length > 0) {
        return next(badRequest(`허용되지 않는 항목입니다: ${unknownFields.join(', ')}`))
    }

    for (const field of SCORE_FIELDS) {
        const score = body[field]
        if (!Number.isInteger(score) || score < 1 || score > 5) {
            return next(badRequest(`${field}는 1부터 5 사이의 정수여야 합니다`))
        }
    }

    next()
}
