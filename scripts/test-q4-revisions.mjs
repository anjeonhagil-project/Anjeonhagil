import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const read=p=>readFileSync(p,'utf8'),db=new PGlite()
let passed=0
try{
    const baseline=read('database/baseline/01_schema.sql').match(/CREATE TABLE public\.users \([\s\S]*?\r?\n\);/)[0]
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}',email_confirmed_at timestamptz); ${baseline}`)
    for(const name of ['20260916_anjeonhagil_foundation','20260916_service_integration','20260917_q4_personalization','20260917_service_flow','20260917_q4_training_prep'])await db.exec(read(`database/migrations/${name}.sql`))
    await db.exec(read('database/migrations/20260917_q4_training_prep.sql'));passed++
    const user=randomUUID(),other=randomUUID()
    for(const id of [user,other])await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,'{\"provider\":\"google\"}')",[id,id+'@example.test'])
    const value=async(sql,args=[])=>(await db.query(sql,args)).rows[0]?.v
    const sv=(await value("select ag_save_preferences($1,'daily','[1,2,0,0,0,0]',NULL) v",[user])).survey_version
    const bank=JSON.parse(read('apps/backend/src/config/q4Cases.json')),questions=bank.cases.COMPLEX_INTERSECTION.map(q=>({...q,routes:q.routes.map((r,i)=>({...r,label:i?'B':'A'}))}))
    const begin=()=>value("select ag_begin_q4($1,$2,$3,'COMPLEX_INTERSECTION','Q2_TOP',$4) v",[user,sv,bank.case_set_version,JSON.stringify(questions)])
    const answer=(s,i,a='A',who=user)=>value('select ag_answer_q4($1,$2,$3,$4) v',[who,s.session_id,i,a])
    const state=()=>value('select to_jsonb(p) v from ag_user_profiles p where user_id=$1',[user])
    const initial=await state(),first=await begin()
    assert.equal((await begin()).session_id,first.session_id);passed++
    await assert.rejects(answer(first,1),/OUT_OF_ORDER/);passed++
    await assert.rejects(answer(first,0,'A',other),/STALE_Q4/);passed++
    await assert.rejects(answer(first,4),/INVALID_Q4/);passed++
    for(let i=0;i<4;i++)await answer(first,i)
    assert.equal((await answer(first,3)).completed,true);passed++
    await assert.rejects(answer(first,0,'B'),/ALREADY_RECORDED/);passed++
    assert.equal(await value('select ag_restart_q4($1) v',[user]),sv)
    await value('select ag_restart_q4($1) v',[user])
    assert.deepEqual(await state(),initial);passed+=2
    const second=await begin();assert.equal(second.revision,2);assert.notEqual(second.session_id,first.session_id)
    assert.equal((await begin()).session_id,second.session_id);passed+=3
    assert.equal(await value('select count(*)::int v from ag_q4_sessions where completed_at is not null'),1);passed++
    await assert.rejects(answer(first,0),/STALE_Q4/);passed++
    await answer(second,0,'UNSURE');await value('select ag_restart_q4($1) v',[user]);assert.equal((await begin()).session_id,second.session_id);passed++
    for(let i=1;i<4;i++)await answer(second,i)
    assert.deepEqual(await state(),initial);passed++
    const trial={policy:{version:'test',productionEnabled:false},multipliers:[1,1]}
    await db.query('insert into ag_q4_trial_estimates(session_id,estimator_version,result) values($1,$2,$3)',[second.session_id,'test',JSON.stringify(trial)])
    await assert.rejects(db.query("update ag_q4_trial_estimates set result='{}' where session_id=$1",[second.session_id]),/IMMUTABLE/);passed++
    await value("select ag_save_preferences($1,'daily','[2,1,0,0,0,0]',NULL) v",[user])
    await assert.rejects(answer(second,0,'UNSURE'),/STALE_Q4/);passed++
    assert.equal(await value('select count(*)::int v from ag_q4_responses'),8);passed++
    for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(db.query('select * from ag_q4_trial_estimates'),/permission denied/);await assert.rejects(db.query('select ag_restart_q4($1)',[user]),/permission denied/);await db.exec('RESET ROLE');passed+=2}
    console.log({passed,scope:'PGlite migrations, ownership, immutable history, restart/resume, unchanged Q2/behavior profile, stale writes, RLS permissions'})
}finally{await db.close()}
