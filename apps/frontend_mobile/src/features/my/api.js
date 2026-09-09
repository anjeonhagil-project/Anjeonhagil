// # 기능: my feature에서 사용하는 Express API 함수 모음


import { apiClient } from '../../lib/apiClient.js'

export function updateMyProfile({ nickname }) {
    return apiClient.patch('/users/me', { nickname })
}

export function getDrivingPreferences() {
    return apiClient.get('/driving-preferences')
}

export function updateDrivingPreferences(answers) {
    return apiClient.put('/driving-preferences', answers)
}

export function withdrawMyAccount() {
    return apiClient.delete('/users/me')
}


// 탈퇴 계정의 복구 가능 상태 조회
export function getMyAccountStatus() {
    return apiClient.get('/users/me/account-status')
}

// 탈퇴 후 30일 이내 계정 복구
export function restoreMyAccount() {
    return apiClient.patch('/users/me/restore')
}