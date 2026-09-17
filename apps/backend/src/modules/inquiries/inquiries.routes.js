// 로그인 사용자의 문의 등록·목록·답변 조회. user_id는 요청 본문에서 받지 않는다.
import {Router} from 'express'
import {supabase} from '../../lib/supabase.js'
import {authenticate} from '../../middleware/authenticate.js'
import {requireActiveUser} from '../../middleware/requireActiveUser.js'
const router=Router()
router.use(authenticate,requireActiveUser)
router.get('/',async(req,res,next)=>{
    try {
        const {data,error}=await supabase.from('inquiries').select('id,category,title,content,status,answer_content,created_at,answered_at').eq('user_id',req.user.id).order('created_at',{ascending:false}).limit(50)
        if(error)throw error
        res.json({success:true,data})
    }catch(e){next(e)}
})
router.post('/',async(req,res,next)=>{
    try {
        const {title,content,category='other'}=req.body||{}
        if(typeof title!=='string'||!title.trim()||title.trim().length>200||typeof content!=='string'||!content.trim()||content.length>10000||!['account','route','other'].includes(category))throw Object.assign(new Error('문의 제목과 내용을 확인해주세요'),{status:400})
        const {data,error}=await supabase.from('inquiries').insert({user_id:req.user.id,title:title.trim(),content:content.trim(),category}).select('id').single()
        if(error)throw error
        res.status(201).json({success:true,data})
    }catch(e){next(e)}
})
export default router
