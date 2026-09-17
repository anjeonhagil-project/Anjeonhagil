// 임시 PostgreSQL에서 최신 migration 재실행, 실제 계산 snapshot, Q4 분리, 소유권/멱등성을 검사한다.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
import {routeSnapshot} from '../apps/backend/src/modules/routes/routeSnapshot.js'
const read=p=>readFileSync(p,'utf8'),db=new PGlite()
const baseline=read('database/baseline/01_schema.sql').match(/CREATE TABLE public\.users \([\s\S]*?\r?\n\);/)[0]
const foundation=read('database/migrations/20260916_anjeonhagil_foundation.sql'),integration=read('database/migrations/20260916_service_integration.sql')
let passed=0
async function reject(sql,args,pattern){await assert.rejects(db.query(sql,args),pattern);passed++}
try {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
        CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}',email_confirmed_at timestamptz);${baseline}`)
    await db.exec(foundation);await db.exec(integration);await db.exec(integration);passed++
    const q4Migration=read('database/migrations/20260917_q4_personalization.sql')
    await db.exec(q4Migration);await db.exec(q4Migration);passed++
    const flowMigration=read('database/migrations/20260917_service_flow.sql')
    await db.exec(flowMigration);await db.exec(flowMigration);passed++
    await db.exec(read('database/migrations/20260917_q4_training_prep.sql'))
    const user=randomUUID(),other=randomUUID()
    for(const id of [user,other]) await db.query("INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES($1,$2,'{\"provider\":\"google\"}')",[id,'test-'+id+'@example.test'])
    const pref=(await db.query("SELECT ag_save_preferences($1,'daily','[2,0,1,0,0,3]',NULL) p",[user])).rows[0].p
    const again=(await db.query("SELECT ag_save_preferences($1,'daily','[2,0,1,0,0,3]',NULL) p",[user])).rows[0].p
    assert.equal(pref.profile_version,again.profile_version);passed++
    await reject("SELECT ag_save_preferences($1,'daily','[2,0,1,0,0,3]',5)",[user],/Q3_REMOVED/)
    await reject("SELECT ag_save_preferences($1,'daily','[1,1,0,0,0,0]',NULL)",[user],/CONTIGUOUS/)
    const questions=Array.from({length:4},(_,i)=>({question_id:'fixture_'+i,routes:[{label:'A'},{label:'B'}]}))
    const q4=(await db.query("SELECT ag_begin_q4($1,$2,'test_cases','NARROW_ROAD','Q2_TOP',$3) s",[user,pref.survey_version,JSON.stringify(questions)])).rows[0].s
    const initial={sessionId:q4.session_id,surveyVersion:pref.survey_version,policy:{version:'test'},source:'ONBOARDING_SURVEY'}
    const storeQ4='INSERT INTO ag_q4_profiles(session_id,policy_version,user_id,survey_version,interpretation) VALUES($1,\'test\',$2,$3,$4)'
    await reject(storeQ4,[q4.session_id,user,pref.survey_version,JSON.stringify(initial)],/COMPLETE_SESSION/)
    await reject("SELECT ag_answer_q4($1,$2,0,'A')",[other,q4.session_id],/STALE/)
    await reject("SELECT ag_answer_q4($1,$2,0,NULL)",[user,q4.session_id],/INVALID_Q4_ANSWER/)
    for(let i=0;i<4;i++) {
        const r=(await db.query('SELECT ag_answer_q4($1,$2,$3,$4) r',[user,q4.session_id,i,i===2?'UNSURE':'A'])).rows[0].r
        assert.equal(r.completed,i===3);passed++
    }
    await db.query("SELECT ag_answer_q4($1,$2,2,'UNSURE')",[user,q4.session_id]);passed++
    await reject("SELECT ag_answer_q4($1,$2,2,'A')",[user,q4.session_id],/ALREADY_RECORDED/)
    assert.equal((await db.query('SELECT count(*)::int n FROM ag_choices')).rows[0].n,0)
    assert.equal((await db.query('SELECT onboarding FROM users WHERE id=$1',[user])).rows[0].onboarding,true);passed+=2
    await db.query(storeQ4,[q4.session_id,user,pref.survey_version,JSON.stringify(initial)]);passed++
    await reject('UPDATE ag_q4_profiles SET interpretation=\'{}\' WHERE session_id=$1',[q4.session_id],/IMMUTABLE/)
    await reject(storeQ4,[q4.session_id,other,pref.survey_version,JSON.stringify(initial)],/COMPLETE_SESSION/)
    await db.exec("UPDATE ag_dataset_releases SET status='ready';INSERT INTO ag_dataset_active(singleton,release_id) SELECT true,release_id FROM ag_dataset_releases LIMIT 1;")
    const fixture=JSON.parse(read('.test-tools/service-routing-fixture.json'))
    const profile=(await db.query('SELECT * FROM ag_profile_versions WHERE profile_version=$1',[pref.profile_version])).rows[0]
    const input={origin:fixture.request.origin,destination:fixture.request.destination,searchId:randomUUID()}
    const payload=routeSnapshot(user,input,profile,fixture.response)
    await db.query('SELECT ag_save_search($1,$2)',[user,JSON.stringify(payload)]);passed++
    assert.deepEqual((await db.query('SELECT response_snapshot FROM ag_searches WHERE search_id=$1',[input.searchId])).rows[0].response_snapshot,payload.response);passed++
    for(const mutate of [p=>p.candidates[0].raw_features[5]+=1,p=>p.search.profile_snapshot.effective_weights=[1,0,0,0,0,0],p=>p.search.max_detour_minutes=5]) {
        const p=structuredClone(payload);p.search.search_id=randomUUID();p.candidates.forEach(c=>{c.search_id=p.search.search_id;c.candidate_id=randomUUID()});mutate(p)
        await reject('SELECT ag_save_search($1,$2)',[user,JSON.stringify(p)],/RAW6|SNAPSHOT|Q3/)
    }
    const exposure=randomUUID(),candidateIds=payload.candidates.map(c=>c.candidate_id),recommended=payload.response.recommendedCandidateId
    const expose='SELECT ag_record_exposure($1,$2,$3,$4,$5)'
    await reject(expose,[other,input.searchId,exposure,JSON.stringify(candidateIds),recommended],/OWNERSHIP/)
    await db.query(expose,[user,input.searchId,exposure,JSON.stringify(candidateIds),recommended])
    await db.query(expose,[user,input.searchId,exposure,JSON.stringify(candidateIds),recommended]);passed++
    await reject('SELECT ag_record_choice($1,$2,$3,$4)',[user,exposure,randomUUID(),randomUUID()],/NOT_EXPOSED/)
    for(let i=0;i<2;i++) await db.query('SELECT ag_record_choice($1,$2,$3,$4)',[user,exposure,randomUUID(),recommended])
    assert.equal((await db.query('SELECT count(*)::int n FROM ag_choices')).rows[0].n,1);passed++
    const visible=randomUUID(),context={policy:'visible_cards_v2',selectionSource:'card',selectionChanges:1,autoSelected:false}
    const exposeV2='SELECT ag_record_exposure_v2($1,$2,$3,$4,$5,$6) e'
    const args=[user,input.searchId,visible,JSON.stringify([recommended]),recommended,JSON.stringify(context)]
    assert.deepEqual((await db.query(exposeV2,args)).rows[0].e.context,context);passed++
    await db.query(exposeV2,args);passed++
    await reject(exposeV2,[...args.slice(0,5),JSON.stringify({...context,selectionChanges:2})],/CONFLICT/)
    await reject(exposeV2,[other,...args.slice(1)],/OWNERSHIP/)
    await reject('UPDATE ag_exposures SET context=\'{}\' WHERE exposure_id=$1',[visible],/IMMUTABLE/)
    const claim=(await db.query('SELECT ag_claim_personalization() q')).rows[0].q
    assert.equal(claim.revision,1);assert.equal(claim.user_id,user);passed+=2
    assert.equal((await db.query('SELECT ag_claim_personalization() q')).rows[0].q,null);passed++
    assert.equal((await db.query('SELECT ag_finish_personalization($1,$2,$3,NULL) done',[user,randomUUID(),claim.revision])).rows[0].done,false);passed++
    // A terminated worker leaves a lease. Expiry allows recovery, old token cannot finish it.
    await db.query("UPDATE ag_personalization_queue SET lease_until=now()-interval '1 second' WHERE user_id=$1",[user])
    const recovery=(await db.query('SELECT ag_claim_personalization() q')).rows[0].q
    assert.notEqual(recovery.lease_token,claim.lease_token);passed++
    assert.equal((await db.query('SELECT ag_finish_personalization($1,$2,$3,NULL) done',[user,claim.lease_token,claim.revision])).rows[0].done,false);passed++
    // New evidence arriving during work remains pending after old revision completes.
    await db.query('UPDATE ag_personalization_queue SET revision=revision+1 WHERE user_id=$1',[user])
    await db.query('SELECT ag_finish_personalization($1,$2,$3,NULL)',[user,recovery.lease_token,recovery.revision])
    const next=(await db.query('SELECT ag_claim_personalization() q')).rows[0].q
    assert.equal(next.revision,2);passed++
    await db.query('SELECT ag_finish_personalization($1,$2,$3,$4)',[user,next.lease_token,next.revision,'TRANSIENT'])
    assert.equal((await db.query('SELECT ag_claim_personalization() q')).rows[0].q,null);passed++
    await reject('UPDATE ag_candidates SET distance_m=1 WHERE candidate_id=$1',[recommended],/IMMUTABLE/)
    await db.exec('SET ROLE anon')
    await reject('SELECT * FROM ag_q4_sessions',[],/permission denied/)
    await reject('SELECT * FROM ag_q4_profiles',[],/permission denied/)
    await reject('SELECT * FROM ag_searches',[],/permission denied/)
    await reject('SELECT * FROM ag_personalization_queue',[],/permission denied/)
    await reject('SELECT ag_claim_personalization()',[],/permission denied/)
    await db.exec('RESET ROLE')
    await db.exec('SET ROLE service_role')
    assert.equal((await db.query('SELECT ag_set_q4_enabled($1,false) v',[user])).rows[0].v,false)
    await db.exec('RESET ROLE');passed++
    const jobFor=async profileVersion=>(await db.query("INSERT INTO ag_profile_update_jobs(user_id,input_profile_version,model_version,history_cutoff,sample_search_count,status) VALUES($1,$2,$3,clock_timestamp(),4,'running') RETURNING job_id",[user,profileVersion,payload.search.model_version])).rows[0].job_id
    const applyJob=async id=>(await db.query("SELECT ag_apply_profile_update($1,'[0.5,0,0.3,0,0,0.2]',1,0.9,'{\"policy\":\"test\"}') v",[id])).rows[0].v
    const staleJob=await jobFor(pref.profile_version)
    await db.query('SELECT ag_reset_profile($1,false)',[user])
    assert.equal(await applyJob(staleJob),null);passed++
    await db.query('SELECT ag_reset_profile($1,true)',[user])
    const current=(await db.query('SELECT active_profile_version FROM ag_user_profiles WHERE user_id=$1',[user])).rows[0].active_profile_version
    const acceptedJob=await jobFor(current),acceptedVersion=await applyJob(acceptedJob)
    assert.ok(acceptedVersion);assert.equal(await applyJob(acceptedJob),acceptedVersion);passed+=2
    const staleModelJob=await jobFor(acceptedVersion)
    await db.query('UPDATE ag_model_versions SET is_active=false WHERE model_version=$1',[payload.search.model_version])
    assert.equal(await applyJob(staleModelJob),null);passed++
    await db.query('UPDATE ag_model_versions SET is_active=true WHERE model_version=$1',[payload.search.model_version])
    const restarted=(await db.query('SELECT ag_restart_q4($1) v',[user])).rows[0].v
    assert.equal(restarted,pref.survey_version)
    assert.equal((await db.query('SELECT ag_restart_q4($1) v',[user])).rows[0].v,restarted)
    assert.equal((await db.query('SELECT count(*)::int n FROM ag_q4_responses WHERE session_id=$1',[q4.session_id])).rows[0].n,4)
    assert.deepEqual((await db.query('SELECT response_snapshot FROM ag_searches WHERE search_id=$1',[input.searchId])).rows[0].response_snapshot,payload.response);passed+=4
    const report={passed,scope:'temporary PostgreSQL; no remote records',q4Separated:true,realRouteFixture:true}
    writeFileSync('.test-tools/service-db-report.json',JSON.stringify(report,null,2));console.log(report)
} finally {await db.close()}
