// Offline/shadow calibration only. This module never changes serving weights.
import {createHash} from 'node:crypto'
export const VERSION='q4_trial_20260917_v1'
export const POLICY=Object.freeze({version:VERSION,experimental:true,productionEnabled:false,bounds:[0.5,2],regularization:1,minimumAnswers:3,minimumDesignRatio:0.01})
export const FEATURES=['time_diff','distance_diff','intersection_weighted_diff','merge_weighted_diff','narrow_weighted_diff','turn_weighted_diff','consecutive_weighted_diff','child_100m_weighted_diff']
export const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const vector=r=>[r.display_duration_s,r.distance_m,...r.raw_features]
export function pair(a,b,weights){
    if(weights.length!==6||weights.some(w=>!Number.isFinite(w)||w<0)||!(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-8||weights.every(w=>w===0)))throw Error('INVALID_Q2_WEIGHTS')
    const av=vector(a),bv=vector(b)
    if(av.length!==8||bv.length!==8||[...av,...bv].some(v=>!Number.isFinite(v)||v<0))throw Error('INVALID_ROUTE_FEATURES')
    return av.map((v,i)=>(v-bv[i])*(i<2?1:weights[i-2]))
}
export function rowsFor(session,answers,weights){
    const seen=new Set()
    return answers.map(answer=>{
        if(!Number.isInteger(answer.question_index)||seen.has(answer.question_index))throw Error('DUPLICATE_OR_INVALID_INDEX')
        seen.add(answer.question_index)
        const q=session.questions[answer.question_index]
        if(!q||!['A','B','UNSURE'].includes(answer.answer))throw Error('INVALID_ANSWER')
        const a=q.routes.find(r=>r.label==='A'),b=q.routes.find(r=>r.label==='B')
        if(!a||!b||a.route_key===b.route_key)throw Error('INVALID_DISPLAYED_PAIR')
        return {questionId:q.question_id,index:answer.question_index,x:pair(a,b,weights),y:answer.answer==='UNSURE'?null:Number(answer.answer==='A'),answer:answer.answer}
    })
}
export function design(rows,model){
    let aa=0,ab=0,bb=0
    for(const row of rows){const a=row.x[0]/model.scales[0],b=row.x[1]/model.scales[1];aa+=a*a;ab+=a*b;bb+=b*b}
    const trace=aa+bb,disc=Math.sqrt((aa-bb)**2+4*ab*ab),max=(trace+disc)/2,min=Math.max(0,(trace-disc)/2)
    return {minimumEigenvalue:min,maximumEigenvalue:max,ratio:max?min/max:0,rank:min>1e-10?2:max>0?1:0}
}
const sigmoid=z=>z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z))
export function probability(row,model,m=[1,1]){return sigmoid(row.x.reduce((s,v,i)=>s+v/model.scales[i]*model.coefficients[i]*(i<2?m[i]:1),0))}
export function fitTrial(rows,model,options={}){
    if(!Array.isArray(rows)||rows.some(r=>!Array.isArray(r.x)||r.x.length!==8||r.x.some(v=>!Number.isFinite(v))||![0,1,null].includes(r.y)))throw Error('INVALID_TRIAL_ROWS')
    if(JSON.stringify(model.feature_order)!==JSON.stringify(FEATURES)||model.intercept!==0||model.with_mean!==false||model.scales?.length!==8||model.scales.some(v=>!Number.isFinite(v)||v<=0)||model.coefficients?.length!==8||model.coefficients.some(v=>!Number.isFinite(v)))throw Error('INVALID_MODEL_CONTRACT')
    const usable=rows.filter(r=>r.y!==null),d=design(usable,model),lambda=options.regularization??POLICY.regularization
    if(!Number.isFinite(lambda)||lambda<=0)throw Error('INVALID_REGULARIZATION')
    const result={policy:{...POLICY,regularization:lambda},modelVersion:model.model_version,modelHash:hash(model),answered:rows.length,usable:usable.length,design:d,multipliers:[1,1],status:'HELD',reason:'INSUFFICIENT_ANSWERS'}
    if(usable.length<POLICY.minimumAnswers)return result
    if(d.ratio<POLICY.minimumDesignRatio)return {...result,reason:'WEAK_TIME_DISTANCE_IDENTIFICATION'}
    const loss=m=>usable.reduce((s,r)=>{const p=Math.max(1e-15,Math.min(1-1e-15,probability(r,model,m)));return s-r.y*Math.log(p)-(1-r.y)*Math.log(1-p)},0)/usable.length
    let best={objective:loss([1,1]),m:[1,1]}
    // Bounded log-space exhaustive search: deterministic and independent of optimizer libraries.
    for(let i=-20;i<=20;i++)for(let j=-20;j<=20;j++){
        const u=i*Math.log(2)/20,v=j*Math.log(2)/20,m=[Math.exp(u),Math.exp(v)]
        const objective=loss(m)+lambda*(u*u+v*v)
        if(objective<best.objective-1e-12)best={objective,m}
    }
    // Refine the grid so a weak but nonzero effect is not rounded into exactly 1.
    let step=Math.log(2)/20
    for(let pass=0;pass<4;pass++){
        const center=best.m.map(Math.log);step/=4
        for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++){
            const u=Math.max(-Math.log(2),Math.min(Math.log(2),center[0]+i*step)),v=Math.max(-Math.log(2),Math.min(Math.log(2),center[1]+j*step)),m=[Math.exp(u),Math.exp(v)]
            const objective=loss(m)+lambda*(u*u+v*v)
            if(objective<best.objective-1e-12)best={objective,m}
        }
    }
    return {...result,status:'TRIAL_ONLY',reason:'REGULARIZED_CONDITIONAL_FIT',multipliers:best.m,baselineLoss:loss([1,1]),fittedLoss:loss(best.m),boundary:best.m.some(v=>v<=0.500001||v>=1.999999),warning:'Conditional on frozen synthetic model and Q2; not calibrated confidence or causal tolerance.'}
}
