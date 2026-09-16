// 수정 필요(Anjeonhagil): Q1~Q3와 Q4 완료 상태를 구분하고 onboarding.service/personalization.service를 연결한다. user_id는 인증에서만 취득한다.
// 기능: PREF-001~002: 운전부담 설정 조회/Upsert HTTP req/res 처리
import * as preferencesService from './preferences.service.js'

// 현재 로그인 사용자의 설문 답변 조회
export async function getDrivingPreferences(req, res, next) {
    try {
        const preferences = await preferencesService.getDrivingPreferences(req.user.id)
        res.json({ success: true, data: preferences })
    } catch (error) {
        next(error)
    }
}

// Q1~Q3 원본 응답 저장. Q4가 끝나기 전에는 전체 온보딩 완료로 처리하지 않는다.
export async function saveDrivingPreferences(req, res, next) {
    try {
        const preferences = await preferencesService.saveDrivingPreferences(req.user.id, req.body)
        res.json({ success: true, data: preferences })
    } catch (error) {
        next(error)
    }
}
