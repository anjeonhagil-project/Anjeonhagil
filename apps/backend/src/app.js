// 수정 필요(Anjeonhagil): 계산기·모델 오류를 공통 오류 응답으로 변환하고 내부 토큰/경로를 노출하지 않는다. 신규 라우터는 routes/index.js에서 등록한다.
// # 기능: Express app 생성, middleware와 `/api` router 연결
import express from 'express'
import cors from 'cors'
import router from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api', router)

app.use(errorHandler)

export default app
