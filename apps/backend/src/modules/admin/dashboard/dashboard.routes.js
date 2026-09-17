// 실제 DB 운영 현황과 로컬 계산기 준비 상태. 예시 수치와 합성 학습 성능을 이용 통계에 합치지 않는다.
import {Router} from 'express'
import {supabase} from '../../../lib/supabase.js'
import {callWorker} from '../../../routing-engine/routingClient.js'
import {authenticate} from '../../../middleware/authenticate.js'
import {requireAdmin} from '../../../middleware/requireAdmin.js'
import {usageBuckets} from './usageBuckets.js'
const router=Router()
const usageCache=new Map()
router.use(authenticate,requireAdmin)
router.get('/usage',async(req,res,next)=>{
    try{
        const period=req.query.period||'today'
        if(!['today','month','year'].includes(period))return res.status(400).json({success:false,message:'조회 기간이 올바르지 않습니다.'})
        const buckets=usageBuckets(period),key=period+buckets[0].start,cached=usageCache.get(key)
        if(cached&&Date.now()-cached.time<30000)return res.json({success:true,data:cached.data})
        const items=[]
        // 정확한 DB count를 사용하고 동시에 보내는 요청은 6개로 제한한다.
        for(let i=0;i<buckets.length;i+=6)items.push(...await Promise.all(buckets.slice(i,i+6).map(async bucket=>{
            const r=await supabase.from('ag_searches').select('*',{head:true,count:'exact'}).eq('sample_origin','service').gte('created_at',bucket.start).lt('created_at',bucket.end)
            if(r.error)throw r.error
            return {...bucket,value:r.count}
        })))
        const result={period,timezone:'Asia/Seoul',items,total:items.reduce((sum,item)=>sum+item.value,0),updatedAt:new Date().toISOString()}
        usageCache.clear();usageCache.set(key,{time:Date.now(),data:result})
        res.json({success:true,data:result})
    }catch(error){next(error)}
})
async function data(query){const r=await query;if(r.error)throw r.error;return r.data}
async function count(table){const r=await supabase.from(table).select('*',{count:'exact',head:true});if(r.error)throw r.error;return r.count}
router.get('/summary',async(req,res,next)=>{
    try {
        const [users,searches,choices,failures,inquiries,models,releases,active]=await Promise.all([
            count('users'),count('ag_searches'),count('ag_choices'),count('ag_route_failures'),count('inquiries'),
            data(supabase.from('ag_model_versions').select('model_version,model_type,is_active,metrics')),
            data(supabase.from('ag_dataset_releases').select('release_id,dataset_version,feature_version,eta_version,status')),
            data(supabase.from('ag_dataset_active').select('release_id').maybeSingle()),
        ])
        let worker
        try{worker=await callWorker('/health',undefined,{timeout:2500})}catch{worker={ok:false,status:'BUSY_OR_UNAVAILABLE'}}
        res.json({success:true,data:{counts:{users,searches,choices,failures,inquiries},models,releases,active,worker}})
    }catch(e){next(e)}
})
router.get('/routes',async(req,res,next)=>{
    try{
        const searches=await data(supabase.from('ag_searches').select('search_id,created_at,model_version,profile_version,sample_origin,response_snapshot').order('created_at',{ascending:false}).limit(50))
        const choices=searches.length?await data(supabase.from('ag_choices').select('search_id,selected_candidate_id').in('search_id',searches.map(s=>s.search_id))):[]
        res.json({success:true,data:searches.map(s=>({searchId:s.search_id,createdAt:s.created_at,modelVersion:s.model_version,profileVersion:s.profile_version,sampleOrigin:s.sample_origin,
            candidateCount:s.response_snapshot?.candidates?.length??0,recommendedId:s.response_snapshot?.recommendedCandidateId,selectedId:choices.find(c=>c.search_id===s.search_id)?.selected_candidate_id??null,
            elapsedSeconds:s.response_snapshot?.diagnostics?.elapsed_seconds??null,degraded:s.response_snapshot?.degraded??false}))})
    }catch(e){next(e)}
})
router.get('/failures',async(req,res,next)=>{
    try{res.json({success:true,data:await data(supabase.from('ag_route_failures').select('id,search_id,error_code,duration_ms,created_at').order('created_at',{ascending:false}).limit(50))})}catch(e){next(e)}
})
export default router
