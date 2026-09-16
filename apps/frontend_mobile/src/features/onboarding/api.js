// 수정 필요(Anjeonhagil): Q1~Q3는 preferences/api.js로 위임하고 Q4 사례/진행 API를 연결한다. 노출·선택은 routes API와 같은 계약을 사용한다.
// 기능: M-ONB 설문 조회/저장 API
import { apiClient } from '../../lib/apiClient.js'

// 기존 설문 답변 조회 (내 정보에서 설문 수정 화면을 만들 때 재사용)
export function getDrivingPreferences() {
    return apiClient.get('/driving-preferences')
}

// Q1~Q4 답변을 저장하고 온보딩 완료 처리
export function saveDrivingPreferences(answers) {
    return apiClient.put('/driving-preferences', answers)
}
