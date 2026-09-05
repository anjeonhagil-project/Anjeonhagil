import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import * as placesController from './places.controller.js'

const router = Router()

// 즐겨찾기 API는 로그인 사용자만 접근 가능
router.use(authenticate)

// 즐겨찾기 목록 조회
router.get('/favorites', placesController.listFavorites)

// 즐겨찾기 추가
router.post('/favorites', placesController.addFavorite)

// 즐겨찾기 수정
router.patch('/favorites/:favoriteId', placesController.editFavorite)

// 즐겨찾기 삭제
router.delete('/favorites/:favoriteId', placesController.removeFavorite)

export default router
