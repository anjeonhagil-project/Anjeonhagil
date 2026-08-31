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
