// Local production Express app + configured Supabase, disposable account, unconditional cleanup.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {randomBytes,randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {parse} from 'dotenv'
import {createClient} from '@supabase/supabase-js'
import assert from 'node:assert/strict'
Object.assign(process.env,parse(readFileSync('apps/backend/.env')))
const {default:app}=await import('../apps/backend/src/app.js')
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r))
const base=`http://127.0.0.1:${server.address().port}/api`
let id,token,passed=0
async function call(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data.error));passed++;return data.data}
async function row(table,select='*'){const r=await db.from(table).select(select).eq('user_id',id).single();assert.ifError(r.error);return r.data}
try{
    const email='q4-test-'+randomUUID()+'@example.test',password=randomBytes(24).toString('base64url')
    const created=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nickname:'Q4검증',username:'q4'+randomBytes(5).toString('hex')}});assert.ifError(created.error);id=created.data.user.id
    const auth=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
    const login=await auth.auth.signInWithPassword({email,password});assert.ifError(login.error);token=login.data.session.access_token
    await call('/users/me/terms','PUT',{agreed:true})
    const pref=await call('/driving-preferences','PUT',{drivingFrequency:'daily',ranks:[1,2,3,0,0,0]})
    const initial=await row('ag_user_profiles')
    const session=await call('/driving-preferences/q4');assert.equal(session.questions.length,4);assert.equal(session.q4AffectsRecommendation,false);passed+=2
    for(let i=0;i<4;i++)await call('/driving-preferences/q4','POST',{sessionId:session.session_id,questionIndex:i,answer:'A'})
    const state=await call('/driving-preferences/personalization');assert.equal(state.q4.training.status,'TRIAL_ONLY');assert.equal(state.q4.training.policy.productionEnabled,false);assert.equal(state.q4.applicable,false);passed+=3
    const restarted=await call('/driving-preferences/q4/restart','POST',{});assert.equal(restarted.surveyVersion,pref.preferences.surveyVersion);assert.deepEqual(await row('ag_user_profiles'),initial);passed+=2
    assert.equal((await call('/driving-preferences/personalization')).q4.pending,true);passed++
    const next=await call('/driving-preferences/q4');assert.notEqual(next.session_id,session.session_id);assert.equal(next.revision,2);passed+=2
    await call('/driving-preferences/q4','POST',{sessionId:next.session_id,questionIndex:0,answer:'UNSURE'})
    const resumed=await call('/driving-preferences/q4');assert.equal(resumed.answers.length,1);assert.equal(resumed.session_id,next.session_id);passed+=2
    for(let i=1;i<4;i++)await call('/driving-preferences/q4','POST',{sessionId:next.session_id,questionIndex:i,answer:'B'})
    const updated=await call('/driving-preferences/personalization');assert.equal(updated.q4.training.sessionId,next.session_id);assert.equal(updated.q4.pending,false);assert.deepEqual(await row('ag_user_profiles'),initial);passed+=3
    const sessions=await db.from('ag_q4_sessions').select('*').eq('user_id',id);assert.ifError(sessions.error);assert.equal(sessions.data.length,2);passed++
    const records=[]
    for(const s of sessions.data){const a=await db.from('ag_q4_responses').select('question_index,answer').eq('session_id',s.session_id).order('question_index');assert.ifError(a.error);records.push({session:s,answers:a.data,survey_weights:[.5,1/3,1/6,0,0,0]})}
    mkdirSync('.test-tools/q4-export-qa',{recursive:true});writeFileSync('.test-tools/q4-export-qa/records.json',JSON.stringify(records))
    execFileSync(process.execPath,['scripts/export-q4-training.mjs','--input=.test-tools/q4-export-qa/records.json','--output=.test-tools/q4-export-qa/output'],{env:{...process.env,Q4_EXPORT_KEY:randomBytes(32).toString('hex')},stdio:'pipe'})
    const exported=JSON.parse(readFileSync('.test-tools/q4-export-qa/output/q4-training.json','utf8'));assert.equal(exported.rows.length,8);assert.equal(exported.manifest.eligible_rows,7);assert.equal(exported.rows.some(r=>r.user_id===id),false);passed+=3
    await call('/driving-preferences','PUT',{drivingFrequency:'daily',ranks:[2,1,0,0,0,0]})
    const changed=await call('/driving-preferences/personalization');assert.equal(changed.q4.status,'INCOMPLETE');assert.equal(changed.q4.training,null);passed+=2
    const choices=await db.from('ag_choices').select('*',{count:'exact',head:true}).eq('user_id',id);assert.ifError(choices.error);assert.equal(choices.count,0);passed++
    const report={passed,scope:'Production Express routes + hosted Supabase, temporary automated test account; export CLI; not real-user efficacy'}
    writeFileSync('.test-tools/q4-api-report.json',JSON.stringify(report,null,2));console.log(report)
}finally{
    if(id){const removed=await db.auth.admin.deleteUser(id);if(removed.error)throw Error('TEMP_ACCOUNT_CLEANUP_FAILED')}
    await new Promise(r=>server.close(r))
}
