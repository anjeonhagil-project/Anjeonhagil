// 기능(Anjeonhagil): 온보딩·마이페이지가 공유하는 Q1/Q2 조회·저장 API다.
import { apiClient } from '../../lib/apiClient.js'

export function getPreferences() {
    return apiClient.get('/driving-preferences')
}

export function savePreferences(answers) {
    return apiClient.put('/driving-preferences', answers)
}
