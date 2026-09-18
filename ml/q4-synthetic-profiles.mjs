import {createHash} from 'node:crypto'
import {fitTrial,probability,rowsFor} from './q4-trial.mjs'

function deterministicUnit(seed,searchId,questionIndex,purpose){
    const digest=createHash('sha256').update(`${seed}:${searchId}:${questionIndex}:${purpose}`).digest()
    return digest.readUInt32BE(0)/0x100000000
}

export function synthesizeProfile(input,model){
    const {searchId,responseSeed,questions,q2Weights,latentMultipliers,referenceSource}=input
    if(!Number.isInteger(searchId)||!Number.isInteger(responseSeed)||!Array.isArray(questions)||questions.length!==4)
        throw Error('INVALID_SYNTHETIC_Q4_INPUT')
    if(!Array.isArray(latentMultipliers)||latentMultipliers.length!==2||latentMultipliers.some(v=>!Number.isFinite(v)||v<0.5||v>2))
        throw Error('INVALID_LATENT_MULTIPLIERS')

    const displayedQuestions=questions.map((question,index)=>{
        const routes=deterministicUnit(responseSeed,searchId,index,'placement')<0.5
            ? [...question.routes].reverse()
            : [...question.routes]
        return {...question,routes:routes.map((route,routeIndex)=>({...route,label:routeIndex?'B':'A'}))}
    })
    const session={questions:displayedQuestions}
    const probes=rowsFor(session,displayedQuestions.map((_,question_index)=>({question_index,answer:'A'})),q2Weights)
    const responses=probes.map((row,question_index)=>({
        question_index,
        answer:deterministicUnit(responseSeed,searchId,question_index,'answer')<probability(row,model,latentMultipliers)?'A':'B'
    }))
    if(referenceSource!=='Q2_TOP'||!displayedQuestions.every(question=>question.training_eligible===true)){
        return {
            responses,
            multipliers:[1,1],
            status:'HELD',
            reason:'UNVALIDATED_BANK_OR_NO_Q2_REFERENCE',
            usable:responses.length,
            design:null,
            baselineLoss:null,
            fittedLoss:null
        }
    }
    const fit=fitTrial(rowsFor(session,responses,q2Weights),model)
    return {
        responses,
        multipliers:fit.multipliers,
        status:fit.status,
        reason:fit.reason,
        usable:fit.usable,
        design:fit.design,
        baselineLoss:fit.baselineLoss??null,
        fittedLoss:fit.fittedLoss??null
    }
}

export function synthesizeProfiles(records,bank,model){
    if(!Array.isArray(records)||!bank?.cases)throw Error('INVALID_SYNTHETIC_Q4_BATCH')
    return records.map(record=>{
        const questions=bank.cases[record.referenceFactor]
        if(!Array.isArray(questions)||questions.length!==4)throw Error('UNKNOWN_Q4_REFERENCE_FACTOR')
        return {searchId:record.searchId,...synthesizeProfile({...record,questions},model)}
    })
}
