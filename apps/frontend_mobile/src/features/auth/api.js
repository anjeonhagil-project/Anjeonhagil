// 기능: auth feature에서 사용하는 Express API 함수 모음
// apiClient 공통 fetch wrapper를 사용
import { apiClient } from '../../lib/apiClient.js'

// 회원가입 시 아이디 중복 확인 요청
export function checkUsername(value) {
    return apiClient.get(`/auth/check-username?value=${encodeURIComponent(value)}`)
}

// 회원가입 시 이메일 중복확인 요청
export function checkEmail(value) {
    return apiClient.get(`/auth/check-email?value=${encodeURIComponent(value)}`)
}
