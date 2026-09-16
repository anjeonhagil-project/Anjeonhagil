// # 기능: Vite 개발 서버/빌드 설정
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {readFileSync} from 'node:fs'

export default defineConfig({
    plugins: [react()],
    // Optional trusted local certificate; /api proxy avoids HTTPS mixed content on phones.
    server: {
        ...(process.env.MOBILE_HTTPS_CERT&&process.env.MOBILE_HTTPS_KEY?{https:{cert:readFileSync(process.env.MOBILE_HTTPS_CERT),key:readFileSync(process.env.MOBILE_HTTPS_KEY)}}:{}),
        proxy:{'/api':{target:process.env.LOCAL_API_TARGET||'http://127.0.0.1:3001',changeOrigin:true}},
    },
})
