// 기능(Anjeonhagil): Q1 운전 빈도, Q2 6개 부담 순위, Q3 허용시간의 원본 응답만 검증한다.
import { DRIVING_FREQUENCIES, FACTOR_ORDER } from '../../routing-engine/routingContract.js'

const ALLOWED_FIELDS = ['drivingFrequency', 'ranks', 'maxDetourMinutes']
const DETOUR_OPTIONS = new Set([null, 0, 5, 10, 15])

function badRequest(message, code = 'INVALID_PREFERENCES') {
    const error = new Error(message)
    error.status = 400
    error.code = code
    return error
}

function hasContiguousRanks(ranks) {
    const selected = ranks.filter((rank) => rank > 0).sort((a, b) => a - b)
    return selected.every((rank, index) => rank === index + 1)
}

export function validateDrivingPreferences(req, res, next) {
    const body = req.body

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return next(badRequest('운전 부담 설문 답변을 입력해주세요'))
    }

    const unknownFields = Object.keys(body).filter((field) => !ALLOWED_FIELDS.includes(field))
    if (unknownFields.length > 0) {
        return next(badRequest(`허용되지 않는 항목입니다: ${unknownFields.join(', ')}`))
    }

    if (!DRIVING_FREQUENCIES.includes(body.drivingFrequency)) {
        return next(badRequest('운전 빈도 응답이 올바르지 않습니다'))
    }
    if (!Array.isArray(body.ranks) || body.ranks.length !== FACTOR_ORDER.length) {
        return next(badRequest(`부담 순위는 ${FACTOR_ORDER.length}개 항목이어야 합니다`))
    }
    if (body.ranks.some((rank) => !Number.isInteger(rank) || rank < 0 || rank > FACTOR_ORDER.length)) {
        return next(badRequest('부담 순위는 0부터 6 사이의 정수여야 합니다'))
    }

    const selectedRanks = body.ranks.filter((rank) => rank > 0)
    if (new Set(selectedRanks).size !== selectedRanks.length || !hasContiguousRanks(body.ranks)) {
        return next(badRequest('선택한 부담 순위는 중복 없이 1순위부터 연속되어야 합니다'))
    }
    if (!Object.hasOwn(body, 'maxDetourMinutes') || !DETOUR_OPTIONS.has(body.maxDetourMinutes)) {
        return next(badRequest('우회 허용시간은 상황에 따라, 0분, 5분, 10분, 15분 중 하나여야 합니다'))
    }

    next()
}
