// Additive, bounded reranking only. Never changes model inputs or probabilities.
import {hash, VERSION as ESTIMATOR} from '../../../../../ml/q4-trial.mjs'
export const BANK = 'q4_joint_training_20260917_v1'
export const POLICY = Object.freeze({version:'q4_bounded_rerank_20260919_v1',maximumModelGap:0.04,maximumBonus:0.02,experimental:true})

export function servingProfile(session, training, model) {
    const profile = {policy:POLICY, sessionId:session.session_id, revision:session.revision,
        surveyVersion:session.survey_version, caseSetVersion:session.case_set_version,
        referenceFactor:session.reference_factor, applicable:false, axes:{}, reason:'INSUFFICIENT_EVIDENCE'}
    if(session.case_set_version!==BANK || session.reference_source!=='Q2_TOP' || session.questions.length!==4 || !session.questions.every(q=>q.training_eligible===true))return profile
    if(!model || training?.status!=='TRIAL_ONLY' || training.policy?.version!==ESTIMATOR || training.modelHash!==hash(model))return profile
    const m=training.multipliers
    if(!Array.isArray(m)||m.length!==2||m.some(v=>!Number.isFinite(v)||v<0.5||v>2)||training.usable<3||!(training.design?.ratio>=0.01))return profile
    const limits=['display_duration_s','distance_m'].map(field=>Math.max(...session.questions.map(q=>Math.abs(q.routes[0][field]-q.routes[1][field]))))
    if(limits.some(v=>!Number.isFinite(v)||v<=0))return profile
    return {...profile,applicable:m.some(v=>Math.abs(v-1)>1e-8),reason:'BOUNDED_POSTPROCESSING',
        multipliers:m, limits, modelVersion:model.model_version, modelHash:training.modelHash,
        utilitySlopes:model.coefficients.slice(0,2).map((v,i)=>v/model.scales[i]),
        estimatorVersion:ESTIMATOR, usableAnswers:training.usable}
}

export function applyServingQ4(result, preference, policy=POLICY) {
    const base=result.recommended_index, cards=result.candidates, n=cards.length
    const audit={...preference,policy,applied:false,changed:false,baselineIndex:base,finalIndex:base,reason:'NO_CONFIRMED_PREFERENCE'}
    result.q4=audit
    if(!preference.enabled){audit.reason='DISABLED';return result}
    if(!preference.applicable)return result
    if(n<2){audit.reason='SINGLE_CANDIDATE';return result}
    if(result.recommendation_method!=='model_logistic'||result.model?.model_version!==preference.modelVersion){audit.reason='MODEL_VERSION_MISMATCH';return result}
    const scores=cards.map(c=>c.recommendation_score/(n-1))
    const valid=Number.isInteger(base)&&base>=0&&base<n&&scores.every(v=>Number.isFinite(v)&&v>=0&&v<=1)
        &&cards.every(c=>[c.display_duration_s,c.distance_m,...(c.raw_features??[])].every(v=>Number.isFinite(v)&&v>=0)&&c.raw_features?.length===6)
        &&preference.utilitySlopes?.length===2&&preference.utilitySlopes.every(v=>Number.isFinite(v)&&v<=0)
        &&preference.multipliers?.length===2&&preference.multipliers.every(v=>Number.isFinite(v)&&v>=.5&&v<=2)
        &&preference.limits?.length===2&&preference.limits.every(v=>Number.isFinite(v)&&v>0)
    if(!valid){audit.reason='INVALID_POSTPROCESSING_INPUT';return result}
    const factor=cards[base].factor_order?.indexOf(preference.referenceFactor)
    if(!(factor>=0&&factor<6)){audit.reason='INVALID_REFERENCE_FACTOR';return result}
    const fields=['display_duration_s','distance_m']
    const dominated=i=>cards.some((c,j)=>j!==i&&fields.every(f=>c[f]<=cards[i][f])&&c.raw_features.every((v,k)=>v<=cards[i].raw_features[k])&&(fields.some(f=>c[f]<cards[i][f])||c.raw_features.some((v,k)=>v<cards[i].raw_features[k])))
    // Logistic derivative is at most 1/4. This is a bounded utility correction,
    // not a second prediction or a calibrated probability.
    const bonuses=cards.map(c=>Math.max(-policy.maximumBonus,Math.min(policy.maximumBonus,
        fields.reduce((sum,f,k)=>sum+preference.utilitySlopes[k]*(preference.multipliers[k]-1)*(c[f]-cards[base][f]),0)/4)))
    const eligible=cards.map((_,i)=>i).filter(i=>i===base||(
        scores[base]-scores[i]<=policy.maximumModelGap&&!dominated(i)
        &&fields.every((f,k)=>Math.abs(cards[i][f]-cards[base][f])<=preference.limits[k])
        &&(!fields.some(f=>cards[i][f]>cards[base][f])||cards[i].raw_features[factor]<cards[base].raw_features[factor])))
    // Preserve the baseline on ties; no arbitrary input-order switch.
    let chosen=base
    for(const i of eligible)if(scores[i]+bonuses[i]>scores[chosen]+bonuses[chosen]+1e-12)chosen=i
    Object.assign(audit,{applied:true,changed:chosen!==base,finalIndex:chosen,reason:chosen===base?'BASELINE_RETAINED':'Q4_BOUNDED_RERANK',modelScores:scores,policyBonuses:bonuses,eligibleIndices:eligible})
    result.recommended_index=chosen
    result.recommendation_method='model_logistic_q4'
    return result
}
