// 게시된 공지만 사용자에게 제공한다. 초안과 작성자 정보는 관리자 API에서 관리한다.
import {Router} from 'express'
import {supabase} from '../../lib/supabase.js'
const router=Router()
router.get('/',async(req,res,next)=>{
    try {
        const {data,error}=await supabase.from('notices').select('id,title,content,published_at').eq('is_published',true).order('published_at',{ascending:false}).limit(50)
        if(error)throw error
        res.json({success:true,data})
    }catch(e){next(e)}
})
export default router
