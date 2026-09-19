// Read-only database export, or offline JSON fixtures. Output contains no names/emails/raw user IDs.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {exportDataset} from '../ml/q4-export.mjs'
const arg=name=>process.argv.find(a=>a.startsWith(name+'='))?.slice(name.length+1)
const output=arg('--output'),input=arg('--input')
if(!output)throw Error('Usage: node scripts/export-q4-training.mjs --input=records.json|--database --output=.test-tools/q4-export (Q4_EXPORT_KEY env required)')
const model=JSON.parse(readFileSync('ml/bundled/logistic.json','utf8'))
let records
if(input)records=JSON.parse(readFileSync(input,'utf8'))
else if(process.argv.includes('--database')){
    const {createClient}=await import('@supabase/supabase-js'),{parse}=await import('dotenv')
    const env={...parse(readFileSync('apps/backend/.env')),...process.env}
    const db=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
    records=[]
    for(let offset=0;;offset+=200){
        const {data,error}=await db.from('ag_q4_sessions').select('*').not('completed_at','is',null).order('session_id').range(offset,offset+199)
        if(error)throw Error('Q4_SESSION_EXPORT_FAILED')
        for(const session of data){
            const a=await db.from('ag_q4_responses').select('question_index,answer,answered_at').eq('session_id',session.session_id).order('question_index')
            const s=await db.from('ag_preference_history').select('survey_weights').eq('survey_version',session.survey_version).eq('user_id',session.user_id).single()
            if(a.error||s.error)throw Error('Q4_CONTEXT_EXPORT_FAILED')
            records.push({session,answers:a.data,survey_weights:s.data.survey_weights})
        }
        if(data.length<200)break
    }
}else throw Error('INPUT_OR_DATABASE_REQUIRED')
const dataset=exportDataset(records,model,process.env.Q4_EXPORT_KEY)
const dest=resolve(output);mkdirSync(dest,{recursive:true})
writeFileSync(join(dest,'q4-training.json'),JSON.stringify(dataset,null,2)+'\n')
const fields=['user_id','session_id','sample_origin','case_set_version','question_id','question_index','answer','y','training_eligible','completed_at',...dataset.manifest.feature_order]
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"'
writeFileSync(join(dest,'q4-pairs.csv'),[fields.join(','),...dataset.rows.map(r=>[r.user_id,r.session_id,r.sample_origin,r.case_set_version,r.question_id,r.question_index,r.answer,r.y,r.training_eligible,r.completed_at,...r.x_base].map(csv).join(','))].join('\n')+'\n')
writeFileSync(join(dest,'manifest.json'),JSON.stringify(dataset.manifest,null,2)+'\n')
console.log(JSON.stringify(dataset.manifest,null,2))
