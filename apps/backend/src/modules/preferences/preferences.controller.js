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

// Q1~Q4 답변 저장 및 온보딩 완료
export async function saveDrivingPreferences(req, res, next) {
    try {
        const preferences = await preferencesService.saveDrivingPreferences(req.user.id, req.body)
        res.json({ success: true, data: preferences })
    } catch (error) {
        next(error)
    }
}
