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

