// 기능: PREF-001~002: 운전부담 설정 조회/Upsert DB query 전담
import { supabase } from '../../lib/supabase.js'

const PREFERENCE_COLUMNS = [
    'user_id',
    'intersection_score',
    'pedestrian_zone_score',
    'narrow_road_score',
    'turn_conflict_score',
].join(', ')

// Q5 화면은 삭제됐지만 기존 DB 컬럼은 NOT NULL이다.
// 사용자에게 묻지 않는 항목은 중립값(보통)으로만 저장하고 개인화 계산에는 사용하지 않는다.
const LEGACY_STRUCTURE_SCORE = 3

// 로그인 사용자 한 명의 설문만 조회
export async function findByUserId(userId) {
    const { data, error } = await supabase
        .from('driving_preferences')
        .select(PREFERENCE_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) throw error
    return data
}

// 기존 테이블에 Q1~Q4 점수를 바로 upsert하고 온보딩 완료 상태를 갱신
export async function completeOnboarding(userId, answers) {
    const { data, error } = await supabase
        .from('driving_preferences')
        .upsert({
            user_id: userId,
            intersection_score: answers.intersectionScore,
            pedestrian_zone_score: answers.pedestrianZoneScore,
            narrow_road_score: answers.narrowRoadScore,
            turn_conflict_score: answers.turnConflictScore,
            structure_score: LEGACY_STRUCTURE_SCORE,
        }, { onConflict: 'user_id' })
        .select(PREFERENCE_COLUMNS)
        .single()

    if (error) throw error

    const { error: userError } = await supabase
        .from('users')
        .update({ onboarding: true })
        .eq('id', userId)

    if (userError) throw userError
    return data
}
