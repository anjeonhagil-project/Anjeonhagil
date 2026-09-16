// 기능(Anjeonhagil): Q1~Q3 최신 설문을 저장·조회하고 Q4 완료 상태를 별도로 반환한다.
import * as preferencesRepository from './preferences.repository.js'

function toResponse(preferences) {
    if (!preferences) {
        return {
            preferences: null,
            onboarding: { surveyCompleted: false, routeChoicesCompleted: false, completedAt: null },
        }
    }

    const progress = preferences.onboarding
    return {
        preferences: {
            surveyVersion: preferences.survey_version,
            drivingFrequency: preferences.driving_frequency,
            ranks: preferences.ranks,
            maxDetourMinutes: preferences.max_detour_minutes,
            updatedAt: preferences.updated_at,
        },
        onboarding: {
            surveyCompleted: true,
            routeChoicesCompleted: Boolean(progress?.completed_at),
            completedAt: progress?.completed_at ?? null,
            caseSetVersion: progress?.case_set_version ?? null,
            requiredCaseIds: progress?.required_case_ids ?? [],
            usesCurrentSurvey: progress?.survey_version === preferences.survey_version,
        },
    }
}

export async function getDrivingPreferences(userId) {
    return toResponse(await preferencesRepository.findByUserId(userId))
}

export async function saveDrivingPreferences(userId, answers) {
    const saved = await preferencesRepository.save(userId, answers)
    if (!saved?.survey_version || !saved?.profile_version) {
        const error = new Error('운전 부담 설정을 저장하지 못했습니다')
        error.status = 500
        error.code = 'PREFERENCES_SAVE_FAILED'
        throw error
    }

    return {
        ...toResponse(await preferencesRepository.findByUserId(userId)),
        profileVersion: saved.profile_version,
    }
}
