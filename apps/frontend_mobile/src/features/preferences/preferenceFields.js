// 기능(Anjeonhagil): 온보딩·마이페이지가 공유하는 Q1/Q2 항목과 클라이언트 검증 규칙이다.
export const DRIVING_FREQUENCY_OPTIONS = Object.freeze([
    { value: 'daily', label: '거의 매일' },
    { value: 'weekly', label: '주 1회 이상' },
    { value: 'monthly', label: '월 1회 이상' },
    { value: 'rarely', label: '거의 운전하지 않음' },
    { value: 'never', label: '아직 운전 경험 없음' },
])

export const BURDEN_FACTORS = Object.freeze([
    { code: 'COMPLEX_INTERSECTION', label: '복잡한 교차로' },
    { code: 'MERGE_BRANCH', label: '합류·분기 구간' },
    { code: 'NARROW_ROAD', label: '좁은 도로·골목길' },
    { code: 'UNFAMILIAR_TURN', label: '크게 꺾이는 회전 구간' },
    { code: 'CONSECUTIVE_ACTION', label: '짧은 간격의 연속 회전·합류' },
    { code: 'CHILD_ZONE_NEARBY', label: '어린이 보호시설 주변' },
])


export function emptyPreferences() {
    return { drivingFrequency: '', ranks: Array(BURDEN_FACTORS.length).fill(null) }
}

export function normalizePreferences(value) {
    if (!value) return emptyPreferences()
    return {
        drivingFrequency: value.drivingFrequency ?? '',
        ranks: Array.isArray(value.ranks) && value.ranks.length === BURDEN_FACTORS.length
            ? value.ranks
            : Array(BURDEN_FACTORS.length).fill(null),
    }
}

export function validatePreferences(value) {
    if (!DRIVING_FREQUENCY_OPTIONS.some((option) => option.value === value.drivingFrequency)) return '운전 빈도를 선택해주세요.'
    if (!Array.isArray(value.ranks) || value.ranks.length !== BURDEN_FACTORS.length
        || value.ranks.some((rank) => !Number.isInteger(rank) || rank < 0 || rank > BURDEN_FACTORS.length)) {
        return '모든 부담 항목의 순위 또는 상관없음을 선택해주세요.'
    }
    const selected = value.ranks.filter((rank) => rank > 0).sort((a, b) => a - b)
    if (new Set(selected).size !== selected.length || selected.some((rank, index) => rank !== index + 1)) {
        return '부담 순위는 중복 없이 1순위부터 연속으로 선택해주세요.'
    }
    return ''
}
