// 실제 후보 풀을 읽어 문항 품질을 평가한다. --write일 때만 새 사례 버전을 저장한다.
import {readFileSync,writeFileSync} from 'node:fs'
const bank=JSON.parse(readFileSync('apps/backend/src/config/q4Cases.json','utf8'))
let pools
try{pools=JSON.parse(readFileSync('.test-tools/q4-pools.json','utf8'))}
catch{throw new Error('후보 캐시를 읽을 수 없습니다. build-q4-cases.py 후보 계산이 완료된 뒤 실행하세요.')}
const scales=JSON.parse(readFileSync('ml/bundled/logistic.json','utf8')).scales.slice(2)
const factors=Object.keys(bank.cases)
// 오프라인 문항 편집 기준이며, 검증된 심리측정 임계값이나 추천 가중치가 아니다.
// 모델 scale은 다른 단위의 변화량을 비교하는 데만 사용한다.
const floors=[1,100,100,1,2,50]
const cases={}
const groups=new Map()
for(const pool of pools){
    const key=JSON.stringify([pool.request.origin,pool.request.destination])
    if(!groups.has(key))groups.set(key,{request:pool.request,candidates:new Map()})
    for(const route of pool.candidates)groups.get(key).candidates.set(route.route_key+route.departure_at,route)
}
const combined=[...groups.values()].map(p=>({...p,candidates:[...p.candidates.values()]}))
for(const [i,factor] of factors.entries()){
    const seen=new Set(),pairs=[]
    for(const pool of combined)for(const a of pool.candidates)for(const b of pool.candidates){
        const key=a.route_key+':'+b.route_key+':'+a.departure_at
        if(seen.has(key)||a.departure_at!==b.departure_at)continue
        seen.add(key)
        const improvement=a.raw_features[i]-b.raw_features[i]
        if(improvement<floors[i])continue
        const target=improvement/scales[i]
        const confounding=a.raw_features.reduce((sum,x,j)=>sum+(j===i?0:Math.abs(x-b.raw_features[j])/scales[j]),0)
        const A=new Set(a.segments.map(s=>s.arc_id)),B=new Set(b.segments.map(s=>s.arc_id))
        const overlap=[...A].filter(x=>B.has(x)).length/new Set([...A,...B]).size
        pairs.push({a,b,improvement,target,confounding,ratio:confounding/target,overlap,time:b.display_duration_s-a.display_duration_s,distance:b.distance_m-a.distance_m,origin:pool.request.origin,destination:pool.request.destination})
    }
    const eligible=pairs.filter(p=>p.target>=.5&&p.improvement/p.a.raw_features[i]>=.2&&p.ratio<=3&&p.overlap<=.8)
    // 카드에서 같은 수치로 보이는 조합을 다른 문항으로 반복하지 않는다.
    const signature=p=>[p.a,p.b].map(r=>[r.display_duration_s,Math.round(r.distance_m/10),Math.round(r.raw_features[i])].join(':')).join('|')
    const slots=[['TIME','SMALL',60,60],['TIME','LARGE',120,600],['DISTANCE','SMALL',100,350],['DISTANCE','LARGE',450,1500]]
    const options=slots.map(([dimension,,min,max])=>eligible.filter(p=>{const d=p[dimension==='TIME'?'time':'distance'];return d>=min&&d<=max}).sort((a,b)=>a.ratio-b.ratio||b.target-a.target||a.a.route_key.localeCompare(b.a.route_key)||a.b.route_key.localeCompare(b.b.route_key)))
    // 후보가 적은 자리부터 탐색한다. 24문항을 모두 확보하지 못하면 저장하지 않는다.
    const order=[0,1,2,3].sort((a,b)=>options[a].length-options[b].length)
    const picked=[],used=new Set()
    function select(n){
        if(n===4)return picked[3].distance>=picked[2].distance*1.5&&picked[3].distance-picked[2].distance>=100
        const slot=order[n]
        for(const p of options[slot]){
            const key=signature(p)
            if(used.has(key))continue
            used.add(key);picked[slot]=p
            if(select(n+1))return true
            used.delete(key)
        }
        return false
    }
    if(!select(0))throw new Error(`No distinct qualified cases: ${factor}; eligible per slot ${options.map(x=>x.length)}`)
    cases[factor]=slots.map(([dimension,level],slot)=>{
        const p=picked[slot]
        console.log(JSON.stringify({factor,dimension,level,improvement:+p.improvement.toFixed(2),time:p.time,distance:Math.round(p.distance),otherToTargetRatio:+p.ratio.toFixed(2)}))
        return {question_id:`${factor}_${dimension}_${level}`,dimension,level,origin:p.origin,destination:p.destination,routes:[p.a,p.b],lower_burden_route_key:p.b.route_key,improvement:p.improvement,single_factor_isolated:false,notice:'실제 경로이므로 시간·거리와 다른 도로 조건도 함께 달라집니다. 다른 도로 조건도 펼쳐 비교해주세요.',selection_quality:{target_scaled:p.target,other_to_target_ratio:p.ratio,directed_arc_jaccard:p.overlap}}
    })
}
if(process.argv.includes('--write'))writeFileSync('apps/backend/src/config/q4Cases.json',JSON.stringify({case_set_version:'q4_real_routes_20260917',source:'VERIFIED_INTERNAL_ROUTES',q4_affects_model:false,selection_policy:{minimum_raw_improvements:floors,minimum_relative_improvement:.2,minimum_scaled_improvement:.5,maximum_other_to_target_ratio:3,maximum_directed_arc_jaccard:.8,note:'문항 편집용 휴리스틱. 인과관계 또는 단일 요인 실험을 보장하지 않는다.'},cases},null,2)+'\n')
