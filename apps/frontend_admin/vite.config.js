// # 기능: 관리자 Web Vite 개발 서버/빌드 설정
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
})
