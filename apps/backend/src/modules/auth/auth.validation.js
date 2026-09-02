// # 기능: 아이디/이메일 형식 검증 규칙 (DB 컬럼 CHECK와 동일)
export const USERNAME_REGEX = /^[a-z][a-z0-9_]{4,19}$/
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
