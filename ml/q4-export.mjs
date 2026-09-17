import {createHmac} from 'node:crypto'
import {rowsFor,fitTrial,FEATURES,hash} from './q4-trial.mjs'
export function exportDataset(records,model,secret){
    if(typeof secret!=='string'||secret.length<32)throw Error('EXPORT_PSEUDONYM_KEY_REQUIRES_32_CHARACTERS')
    const pseudonym=(kind,id)=>createHmac('sha256',secret).update(kind+':'+id).digest('hex')
    const rows=[],audit=[],seen=new Set()
    for(const record of records){
        const {session,answers,survey_weights:weights}=record
        if(!session?.completed_at)continue
        if(seen.has(session.session_id))throw Error('DUPLICATE_SESSION');seen.add(session.session_id)
        if(answers.length!==session.questions.length)throw Error('INCOMPLETE_COMPLETED_SESSION')
        const pairs=rowsFor(session,answers,weights),eligible=session.reference_source==='Q2_TOP'&&session.questions.every(q=>q.training_eligible===true)
        const trial=eligible?fitTrial(pairs,model):null
        const user=pseudonym('user',session.user_id),id=pseudonym('session',session.session_id)
        audit.push({user_id:user,session_id:id,case_set_version:session.case_set_version,revision:session.revision,completed_at:session.completed_at,eligible,trial})
        for(const p of pairs){
            const q=session.questions[p.index],a=q.routes.find(r=>r.label==='A'),b=q.routes.find(r=>r.label==='B')
            for(const r of [a,b])for(const field of ['feature_version','contract_version','eta_version'])if(r[field]!==model[field])throw Error('MODEL_ROUTE_VERSION_MISMATCH')
            rows.push({user_id:user,session_id:id,sample_origin:'Q4_SURVEY',case_set_version:session.case_set_version,question_id:p.questionId,question_index:p.index,answer:p.answer,y:p.y,training_eligible:eligible&&p.y!==null,q2_weights:weights,x_base:p.x,
                route_a:{route_key:a.route_key,display_duration_s:a.display_duration_s,distance_m:a.distance_m,raw_features:a.raw_features},route_b:{route_key:b.route_key,display_duration_s:b.display_duration_s,distance_m:b.distance_m,raw_features:b.raw_features},
                versions:{feature_version:a.feature_version,contract_version:a.contract_version,eta_version:a.eta_version,dataset_version:a.dataset_version},
                // Never include full-session fitted weights as training features: they saw this label.
                completed_at:session.completed_at})
        }
    }
    return {manifest:{schema:'q4_pairs_v1',feature_order:FEATURES,model_hash:hash(model),model_version:model.model_version,row_count:rows.length,eligible_rows:rows.filter(r=>r.training_eligible).length,rows_sha256:hash(rows),warning:'x_base is unscaled. Trial coefficients are audit only; recompute from calibration sessions inside each split.'},rows,trial_audit:audit}
}
