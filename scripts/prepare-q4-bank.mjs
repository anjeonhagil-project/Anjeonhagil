// Re-select real routes, without fabricating/altering route metrics. Writes only with --write.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {design,pair,probability,hash} from '../ml/q4-trial.mjs'
const bank=JSON.parse(readFileSync('apps/backend/src/config/q4Cases.json','utf8'))
const legacy=JSON.parse(readFileSync('scripts/fixtures/q4-legacy.json','utf8'))
const model=JSON.parse(readFileSync('ml/bundled/logistic.json','utf8'))
const pools=JSON.parse(readFileSync('.test-tools/q4-pools.json','utf8'))
const factors=Object.keys(bank.cases),floors=[1,100,100,1,2,50]
const groups=new Map()
for(const pool of pools){const key=JSON.stringify([pool.request.origin,pool.request.destination]);if(!groups.has(key))groups.set(key,{...pool,routes:new Map()});for(const r of pool.candidates)groups.get(key).routes.set(r.route_key+':'+r.departure_at,r)}
const report={method:'joint_8_feature_comparison_not_tolerance_threshold',sourcePoolCount:pools.length,sourceCandidateSlots:pools.reduce((n,p)=>n+p.candidates.length,0),sourceHash:hash(pools),modelHash:hash(model),before:[],after:[],limitations:['Synthetic model used only for design diagnostics; no real-user efficacy claim.','Four answers cannot establish precise individual coefficients.'],selectionPolicy:{maximumOtherToTargetRatio:1,minimumDesignRatio:.03,ranking:'confounding - log(4*p*(1-p)) + cross-axis change - 2*design ratio; p conditional on single Q2 priority'},factors:{}}
function summary(f,questions){
    const index=factors.indexOf(f),weights=factors.map((_,i)=>i===index?1:0)
    return questions.map(q=>{const [a,b]=q.routes,x=pair(a,b,weights),lo=q.routes.find(r=>r.route_key===q.lower_burden_route_key),hi=q.routes.find(r=>r.route_key!==q.lower_burden_route_key);return {factor:f,id:q.question_id,dimension:q.dimension,seconds:lo.display_duration_s-hi.display_duration_s,meters:lo.distance_m-hi.distance_m,improvement:hi.raw_features[index]-lo.raw_features[index],otherRatio:q.selection_quality.other_to_target_ratio,pSinglePriority:probability({x},model),routeKeys:q.routes.map(r=>r.route_key)}})
}
const cases={}
for(const [i,f] of factors.entries()){
    report.before.push(...summary(f,legacy.cases[f]))
    const candidates=[],seen=new Set(),weights=factors.map((_,j)=>j===i?1:0)
    for(const group of groups.values()){
        const routes=[...group.routes.values()]
        for(const a of routes)for(const b of routes){
            if(a.route_key===b.route_key||a.departure_at!==b.departure_at)continue
            const key=[a.route_key,b.route_key,a.departure_at].join(':');if(seen.has(key))continue;seen.add(key)
            const improvement=a.raw_features[i]-b.raw_features[i],scaled=improvement/model.scales[i+2]
            if(improvement<floors[i]||improvement/a.raw_features[i]<.2||scaled<.5)continue
            const ratio=a.raw_features.reduce((s,v,j)=>s+(j===i?0:Math.abs(v-b.raw_features[j])/model.scales[j+2]),0)/scaled
            if(ratio>1)continue
            const arcsA=new Set(a.segments.map(s=>s.arc_id)),arcsB=new Set(b.segments.map(s=>s.arc_id)),overlap=[...arcsA].filter(v=>arcsB.has(v)).length/new Set([...arcsA,...arcsB]).size
            if(overlap>.8)continue
            const dt=b.display_duration_s-a.display_duration_s,dd=b.distance_m-a.distance_m
            const dimension=dt>=60&&dt<=300&&Math.abs(dd)/model.scales[1]<=.5*dt/model.scales[0]?'TIME':dd>=100&&dd<=1500&&Math.abs(dt)/model.scales[0]<=.5*dd/model.scales[1]?'DISTANCE':null
            if(!dimension)continue
            const x=pair(a,b,weights),p=probability({x},model)
            // Avoid trivially certain pairs under the reference model where possible.
            const cost=ratio-Math.log(Math.max(1e-8,4*p*(1-p)))+ (dimension==='TIME'?Math.abs(dd)/model.scales[1]:Math.abs(dt)/model.scales[0])
            candidates.push({question_id:'',dimension,level:'COMPARISON',origin:group.request.origin,destination:group.request.destination,routes:[a,b],lower_burden_route_key:b.route_key,improvement,single_factor_isolated:false,selection_quality:{target_scaled:scaled,other_to_target_ratio:ratio,directed_arc_jaccard:overlap},cost,x})
        }
    }
    const selected=[],used=new Set(),displayed=new Set()
    const signature=q=>q.routes.map(r=>[r.display_duration_s,Math.round(r.distance_m/10),Math.round(r.raw_features[i])].join(':')).join('|')
    for(const dimension of ['TIME','DISTANCE','TIME','DISTANCE']){
        const choices=candidates.filter(q=>q.dimension===dimension&&!used.has(q.routes.map(r=>r.route_key).sort().join(':'))&&!displayed.has(signature(q)))
        choices.sort((a,b)=>{
            const score=q=>q.cost-2*design([...selected,q].map(r=>({x:r.x})),model).ratio
            return score(a)-score(b)||a.routes[0].route_key.localeCompare(b.routes[0].route_key)
        })
        const q=choices[0];if(!q)break
        used.add(q.routes.map(r=>r.route_key).sort().join(':'));displayed.add(signature(q));selected.push(q)
    }
    const d=design(selected.map(q=>({x:q.x})),model)
    if(selected.length!==4||d.ratio<.03){
        cases[f]=bank.cases[f].map(q=>({...q,training_eligible:false,training_hold_reason:'INSUFFICIENT_QUALIFIED_REAL_PAIRS'}))
        report.after.push(...summary(f,cases[f]));report.factors[f]={eligible:candidates.length,status:'HELD',reason:'INSUFFICIENT_QUALIFIED_REAL_PAIRS',design:d};continue
    }
    cases[f]=selected.map(({cost,x,...q},n)=>({...q,training_eligible:true,question_id:`${f}_JOINT_${n+1}`,notice:'실제 경로의 모든 조건을 함께 비교해주세요. 문항 간 우회 허용 한계를 측정하지 않습니다.'}))
    report.after.push(...summary(f,cases[f]));report.factors[f]={eligible:candidates.length,design:d}
}
const next={case_set_version:'q4_joint_training_20260917_v1',source:'VERIFIED_INTERNAL_ROUTES',q4_affects_model:false,purpose:'TRAINING_PREPARATION_ONLY',selection_policy:report.selectionPolicy,cases}
mkdirSync('docs/q4',{recursive:true})
if(process.argv.includes('--write')){
    writeFileSync('apps/backend/src/config/q4Cases.json',JSON.stringify(next,null,2)+'\n');writeFileSync('docs/q4/bank-audit.json',JSON.stringify({...report,bankHash:hash(next)},null,2)+'\n')
    const labels=['복잡 교차로','합류·분기','좁은 도로','낯선 회전','연속 조작','어린이 시설 주변']
    const lines=['# Q4 24문항 검토 결과','',`실제 후보 ${report.sourceCandidateSlots}개 슬롯(${pools.length}개 탐색 묶음)을 검사했습니다. 20문항을 재선정했고 합류·분기 4문항은 기존 자료를 보존하되 학습에서 제외합니다.`,'','모든 변화량은 부담이 줄어드는 경로를 택할 때의 변화입니다. 부담 개선량은 요인별 단위가 달라 서로 직접 비교하지 않습니다. 혼입 비율은 학습 정확도가 아닙니다.','', '| 요인 | 비교 | 추가 초 | 추가 m | 부담 감소 | 혼입 비율 | 학습 후보 |','|---|---|---:|---:|---:|---:|---|',...report.after.map((r,i)=>`| ${labels[factors.indexOf(r.factor)]} | ${r.dimension==='TIME'?'시간':'거리'} ${Math.floor(i%4/2)+1} | ${r.seconds} | ${r.meters.toFixed(1)} | ${r.improvement.toFixed(2)} | ${r.otherRatio.toFixed(2)} | ${report.factors[r.factor].status==='HELD'?'제외':'사용 가능'} |`),'','## 무엇이 개선되었나','', '- 시간/거리 질문에서 반대 축의 변화량을 제한하고 중복 비교쌍을 제외했습니다.','- 목표 부담 변화 외 다른 부담 변화 비율을 기존 최대 3에서 1로 강화했습니다.','- 고정 합성 모델이 한쪽을 거의 확실하게 고르는 비교쌍에는 추가 패널티를 주었습니다. 그래도 모든 문항의 예측이 균형적이지는 않습니다.','- SMALL 거부/LARGE 수용을 모순으로 판단하지 않습니다. 실제 8개 차이와 응답을 함께 기록합니다.','','## 계수 확정 전에 남은 한계','', '- 24문항은 문항은행 크기이며 사용자당 표본은 4개입니다. 4개 응답으로 정밀한 시간·거리 민감도를 확인했다고 주장할 수 없습니다.','- 합류·분기는 추가 탐색을 포함해 기준을 통과하는 조합을 확보하지 못했습니다. 현재 응답은 감사용으로만 보존합니다.','- Q2를 해당 요인 하나만 선택한 극단적 경우, 낯선 회전 등에서는 여전히 모델 확률이 한쪽으로 치우칩니다. 이는 합성 모델·Q2 가중치·후보 분포의 결합 결과입니다.','- 따라서 사용 가능은 데이터 계약/이번 선별 기준 통과를 뜻합니다. 실제 사람 대상 타당성 검증 완료를 뜻하지 않습니다.','- 계수 정규화와 확률 민감도는 trial-validation.json, 전체 학습 절차는 README.md를 확인하세요.','']
    writeFileSync('docs/q4/BANK_REVIEW.md',lines.join('\n'))
}
console.log(JSON.stringify({factors:report.factors,questions:report.after.length,written:process.argv.includes('--write')},null,2))
