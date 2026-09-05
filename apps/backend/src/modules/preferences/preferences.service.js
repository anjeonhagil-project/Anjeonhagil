// 기능: PREF-001~002: 운전부담 설정 조회/Upsert 비즈니스 규칙/transaction
import * as preferencesRepository from './preferences.repository.js'

function toResponse(preferences) {
    if (!preferences) return null

    return {
        userId: preferences.user_id,
        intersectionScore: preferences.intersection_score,
        pedestrianZoneScore: preferences.pedestrian_zone_score,
        narrowRoadScore: preferences.narrow_road_score,
        turnConflictScore: preferences.turn_conflict_score,
    }
}

// 설문 미완료 사용자는 null로 반환해 프론트에서 시작 화면을 보여줄 수 있게 함
export async function getDrivingPreferences(userId) {
    const preferences = await preferencesRepository.findByUserId(userId)
    return toResponse(preferences)
}

// Q1~Q4 모두 저장돼야만 users.onboarding을 완료 상태로 변경
export async function saveDrivingPreferences(userId, answers) {
    const preferences = await preferencesRepository.completeOnboarding(userId, answers)

    if (!preferences) {
        const error = new Error('운전 부담 설정을 저장하지 못했습니다')
        error.status = 500
        throw error
    }

    return {
        ...toResponse(preferences),
        onboarding: true,
    }
}
