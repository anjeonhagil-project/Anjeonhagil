// # 기능: 모든 자체 endpoint를 `/api` 아래 연결
// # 주의: `/api/v1`은 현재 FINAL에서 사용하지 않음
import { Router } from 'express'

const router = Router()

router.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok' } })
})

export default router
