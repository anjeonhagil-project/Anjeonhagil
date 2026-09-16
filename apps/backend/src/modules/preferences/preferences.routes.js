// 기능(Anjeonhagil): 인증된 활성 사용자의 Q1/Q2 설문 조회·저장 endpoint를 연결한다.
import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import * as preferencesController from './preferences.controller.js'
import { validateDrivingPreferences } from './preferences.validation.js'
// 회원 탈퇴로 인한 온보딩 삭제
import { requireActiveUser } from '../../middleware/requireActiveUser.js'
import * as onboarding from './onboarding.service.js'
import * as personalization from './personalization.service.js'

const router = Router()

router.use(authenticate, requireActiveUser)
router.get('/personalization',async(req,res,next)=>{try{res.json({success:true,data:await personalization.profile(req.user.id)})}catch(e){next(e)}})
router.post('/personalization/reset',async(req,res,next)=>{try{res.json({success:true,data:await personalization.reset(req.user.id,req.body?.enabled??null)})}catch(e){next(e)}})
router.get('/q4',async(req,res,next)=>{try{res.json({success:true,data:await onboarding.items(req.user.id)})}catch(e){next(e)}})
router.post('/q4',async(req,res,next)=>{try{res.json({success:true,data:await onboarding.answer(req.user.id,req.body)})}catch(e){next(e)}})

router
    .route('/')
    .get(preferencesController.getDrivingPreferences)
    .put(validateDrivingPreferences, preferencesController.saveDrivingPreferences)

export default router
