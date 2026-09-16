// 기능: 임시 PostgreSQL(PGlite)에서 일괄 SQL의 재실행·인증 이력·소유권·선택 멱등성·프로필 경합을 검사한다. 원격 DB에 연결하지 않는다.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

process.on('uncaughtException', (error) => {
    console.error(JSON.stringify({ message: error.message, detail: error.detail, where: error.where, position: error.position, stack: error.stack?.split('\n').slice(0, 5) }, null, 2))
    process.exitCode = 1
})

const modulePath = process.argv[2]
if (!modulePath) throw new Error('Usage: node scripts/test-migration.mjs <path/to/@electric-sql/pglite/dist/index.js>')
const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href)
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const sql = read('database/migrations/20260916_anjeonhagil_foundation.sql')
const baselineUsers = read('database/baseline/01_schema.sql').match(/CREATE TABLE public\.users \([\s\S]*?\r?\n\);/)[0]
let passed = 0
async function reject(db, query, params = [], pattern) {
    await assert.rejects(db.query(query, params), pattern)
    passed++
}
async function setup(previous) {
    const db = new PGlite()
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', raw_app_meta_data jsonb DEFAULT '{}', email_confirmed_at timestamptz);
        ${baselineUsers}`)
    if (previous) await db.exec(read(`database/migrations/${previous}`))
    return db
}
const db = await setup()
try {
    await db.exec(read('database/20260916_preflight.sql'))
    await db.exec(sql)
    await db.exec(sql)
    assert.equal((await db.query("select count(*)::int n from pg_tables where schemaname='public' and tablename like 'ag_%'")).rows[0].n, 13)
    assert.equal((await db.query('select count(*)::int n from ag_dataset_active')).rows[0].n, 0)
    passed += 2
    const user = randomUUID(), other = randomUUID()
    for (const id of [user, other]) await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,'{\"provider\":\"google\"}')", [id, `test-${id}@example.test`])
    assert.equal((await db.query('select count(*)::int n from users')).rows[0].n, 2)
    passed++
    const savePref = 'select ag_save_preferences($1,$2,$3::jsonb,$4) value'
    await reject(db, savePref, [user, 'daily', '[1,1,0,0,0,0]', 5], /CONTIGUOUS/)
    await reject(db, savePref, [user, 'daily', '[1,3,0,0,0,0]', 5], /CONTIGUOUS/)
    await reject(db, savePref, [user, 'daily', '[true,0,0,0,0,0]', 5], /INTEGER_RANK/)
    await reject(db, savePref, [user, 'daily', '[1,0,0,0,0,-1]', 5], /INTEGER_RANK/)
    await reject(db, savePref, [user, 'daily', null, 5], /SIX_RANKS/)
    await reject(db, savePref, [user, 'daily', '[1,0,0,0,0,0]', 20], /check constraint/)
    await reject(db, savePref, [user, 'unknown', '[1,0,0,0,0,0]', 5], /check constraint/)
    const pref = (await db.query(savePref, [user, 'daily', '[1,2,0,0,0,0]', null])).rows[0].value
    await db.query(savePref, [other, 'never', '[0,0,0,0,0,0]', 0])
    assert.equal(pref.survey_weights.length, 6)
    assert.equal((await db.query('select max_detour_minutes from ag_preference_history where survey_version=$1', [pref.survey_version])).rows[0].max_detour_minutes, null)
    passed += 2
    const versions = {dataset_version:'seoul_static_20260915_review2',contract_version:'anjeon_contract_v6_child100',feature_version:'static_burden_v5_child_circle_inside',eta_version:'internal_hourly_topis_v1',routing_policy_version:'review_exclusion_v1'}
    const release = 'anjeon_final_20260915_child100_v3'
    const payload = () => {
        const id = randomUUID(), at = '2026-09-16T08:00:00+09:00'
        return {
            search: {search_id:id,release_id:release,profile_version:pref.profile_version,model_version:'survey_only_v1',departure_at:at,origin:{lat:37.5,lng:127},destination:{lat:37.51,lng:127.01},max_detour_minutes:5,minimum_internal_duration_s:61,
                profile_snapshot:{profile_version:pref.profile_version,survey_version:pref.survey_version,effective_weights:pref.effective_weights},versions:{...versions}},
            candidates: [0,1].map((i) => ({candidate_id:randomUUID(),search_id:id,user_id:user,release_id:release,...versions,profile_version:pref.profile_version,profile_weights:pref.effective_weights,model_version:'survey_only_v1',departure_at:at,
                factor_order:['COMPLEX_INTERSECTION','MERGE_BRANCH','NARROW_ROAD','UNFAMILIAR_TURN','CONSECUTIVE_ACTION','CHILD_ZONE_NEARBY'],units:['count','score*m','score*m','count','count','m'],
                route_types:[i ? 'safe' : 'shortestTime'],segments:[{arc_id:2+i,start_fraction:0,end_fraction:1}],distance_m:100,internal_duration_s:61+i*60,display_duration_s:60+i*60,display_duration_source:'INTERNAL_HOURLY',raw_features:[0,0,0,0,0,10],geometry:{type:'LineString',coordinates:[[127,37.5],[127.01,37.51]]},hourly_speed_coverage:{},quality:{child_circle_inside_m:10}})),
        }
    }
    const save = 'select ag_save_search($1,$2::jsonb)'
    await reject(db, save, [user, JSON.stringify(payload())], /ACTIVE_DATASET_MISMATCH/)
    await db.query("update ag_dataset_releases set status='ready' where release_id=$1", [release])
    await db.query('insert into ag_dataset_active(singleton,release_id) values(true,$1)', [release])
    await reject(db, "update ag_dataset_releases set feature_version='wrong' where release_id=$1", [release], /IMMUTABLE/)
    await reject(db, "update ag_model_versions set feature_version='wrong' where model_version='survey_only_v1'", [], /IMMUTABLE/)
    assert.deepEqual((await db.query('select manifest from ag_dataset_releases where release_id=$1', [release])).rows[0].manifest, JSON.parse(read('apps/backend/routing/service_manifest.json')))
    passed++
    const invalid = [
        [p => delete p.search.versions.feature_version, /VERSION_MISMATCH/],
        [p => p.search.max_detour_minutes = 20, /check constraint/],
        [p => p.search.departure_at = '2026-09-16T08:00:00', /TIMEZONE/],
        [p => p.candidates[0].user_id = other, /CONTEXT/],
        [p => p.candidates[0].raw_features[5] = 11, /RAW6/],
        [p => p.candidates[0].raw_features[0] = null, /RAW6/],
        [p => p.candidates[0].raw_features[0] = true, /RAW6/],
        [p => p.candidates[0].factor_order.reverse(), /FEATURE_SCHEMA/],
        [p => p.candidates[0].units[5] = 'count', /FEATURE_SCHEMA/],
        [p => p.candidates[0].internal_duration_s = 362, /Q3/],
        [p => p.candidates[0].display_duration_s = 61, /DISPLAY_TIME/],
        [p => p.candidates[0].segments[0].start_fraction = 1, /FRACTIONS/],
        [p => p.candidates[0].segments[0].arc_id = true, /SEGMENT/],
        [p => p.search.profile_snapshot.effective_weights = [1,0,0,0,0,0], /PROFILE_SNAPSHOT/],
    ]
    for (const [mutate, pattern] of invalid) { const p = payload(); mutate(p); await reject(db, save, [user,JSON.stringify(p)],pattern) }
    await reject(db, save, [other,JSON.stringify(payload())],/PROFILE_OWNERSHIP/)
    assert.equal((await db.query('select count(*)::int n from ag_searches')).rows[0].n, 0)
    passed++
    const p = payload()
    await db.query(save, [user,JSON.stringify(p)])
    const sid = p.search.search_id, ids = p.candidates.map(c => c.candidate_id), exposure = randomUUID()
    const expose = 'select ag_record_exposure($1,$2,$3,$4::jsonb,$5) value'
    await reject(db, expose, [other,sid,randomUUID(),JSON.stringify(ids),null], /OWNERSHIP/)
    await reject(db, expose, [user,sid,randomUUID(),'[]',null], /EXPOSURE/)
    await reject(db, expose, [user,sid,randomUUID(),JSON.stringify([ids[0],ids[0]]),null], /EXPOSURE_IDS/)
    await reject(db, expose, [user,sid,randomUUID(),JSON.stringify([randomUUID()]),null], /NOT_IN_SEARCH/)
    await db.query(expose, [user,sid,exposure,JSON.stringify(ids),ids[0]])
    await db.query(expose, [user,sid,exposure,JSON.stringify(ids),ids[0]])
    const choose = 'select ag_record_choice($1,$2,$3,$4) value'
    await reject(db, choose, [other,exposure,randomUUID(),ids[0]],/NOT_EXPOSED/)
    await reject(db, choose, [user,exposure,randomUUID(),randomUUID()],/NOT_EXPOSED/)
    const first = (await db.query(choose,[user,exposure,randomUUID(),ids[0]])).rows[0].value
    const secondExposure = randomUUID()
    await db.query(expose,[user,sid,secondExposure,JSON.stringify(ids),null])
    const retry = (await db.query(choose,[user,secondExposure,randomUUID(),ids[0]])).rows[0].value
    assert.equal(retry.choice_event_id, first.choice_event_id)
    passed++
    await reject(db, choose,[user,secondExposure,randomUUID(),ids[1]],/ALREADY_RECORDED/)
    await reject(db,'update ag_candidates set distance_m=200 where candidate_id=$1',[ids[0]],/IMMUTABLE/)
    await db.exec('SET ROLE authenticated')
    await reject(db, choose,[user,exposure,randomUUID(),ids[0]],/permission denied/)
    await reject(db,'select * from ag_choices',[],/permission denied/)
    await db.exec('RESET ROLE; SET ROLE service_role')
    await reject(db,'insert into ag_candidates(candidate_id) values($1)',[randomUUID()],/permission denied/)
    await db.query(choose,[user,exposure,randomUUID(),ids[0]])
    await db.exec('RESET ROLE')
    // Q4는 설문 저장과 별도이며, 재시도/설문 수정/권한/내보내기까지 함께 검사한다.
    {
        const ou = randomUUID()
        await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,'{\"provider\":\"google\"}')", [ou, 'onboarding@example.test'])
        let op = (await db.query(savePref,[ou,'daily','[1,2,0,0,0,0]',5])).rows[0].value
        const start = 'select ag_start_onboarding($1,$2,$3::jsonb) value'
        const complete = async () => (await db.query('select onboarding from users where id=$1',[ou])).rows[0].onboarding
        assert.equal(await complete(),false); passed++
        await reject(db,start,[ou,'cases1','["A"]'],/INVALID_ONBOARDING/)
        await reject(db,start,[ou,'cases1','["A","A"]'],/INVALID_ONBOARDING/)
        await reject(db,start,[ou,'cases1','["A",true]'],/INVALID_ONBOARDING/)
        const begun=(await db.query(start,[ou,'cases1','["A","B"]'])).rows[0].value
        assert.deepEqual((await db.query(start,[ou,'cases1','["A","B"]'])).rows[0].value,begun); passed++
        await reject(db,start,[ou,'cases2','["A","B"]'],/CASE_SET_LOCKED/)
        const casePayload = (caseId) => {
            const p=payload()
            Object.assign(p.search,{profile_version:op.profile_version,profile_snapshot:{profile_version:op.profile_version,survey_version:op.survey_version,effective_weights:op.effective_weights},sample_origin:'onboarding',onboarding_case_set_version:'cases1',onboarding_case_id:caseId})
            for(const c of p.candidates)Object.assign(c,{user_id:ou,profile_version:op.profile_version,profile_weights:op.effective_weights})
            return p
        }
        await reject(db,save,[ou,JSON.stringify(casePayload('unknown'))],/CASE_MISMATCH/)
        const exposeCase = async (caseId) => {
            const p=casePayload(caseId),e=randomUUID();await db.query(save,[ou,JSON.stringify(p)])
            const ids=p.candidates.map(c=>c.candidate_id)
            await reject(db,expose,[ou,p.search.search_id,randomUUID(),JSON.stringify(ids.slice(0,1)),null],/TWO_CANDIDATES/)
            await db.query(expose,[ou,p.search.search_id,e,JSON.stringify(ids),null])
            return [ou,e,randomUUID(),ids[0]]
        }
        const a=await exposeCase('A')
        await db.query(choose,a);await db.query(choose,a)
        assert.equal(await complete(),false);passed++
        await db.query(choose,await exposeCase('A'))
        assert.equal(await complete(),false);passed++
        const stale=await exposeCase('B')
        op=(await db.query(savePref,[ou,'weekly','[1,2,0,0,0,0]',5])).rows[0].value
        await reject(db,choose,stale,/STALE_ONBOARDING/)
        await db.query(start,[ou,'cases1','["A","B"]'])
        await db.query(choose,await exposeCase('A'))
        assert.equal(await complete(),false);passed++
        await db.query(choose,await exposeCase('B'))
        assert.equal(await complete(),true);passed++
        const ev=(await db.query('select * from ag_choice_training_events where user_id=$1 order by chosen_at',[ou])).rows
        assert.equal(ev.length,4)
        assert.equal(ev[0].sample_origin,'onboarding')
        assert.deepEqual(ev[0].profile_weights,op.effective_weights)
        assert.deepEqual(ev[0].snapshots.map(c=>c.candidate_id),ev[0].displayed_candidate_ids);passed+=4
        await db.query(savePref,[ou,'monthly','[2,1,0,0,0,0]',10])
        assert.equal(await complete(),true);passed++
        await db.exec('SET ROLE authenticated')
        await reject(db,'select * from ag_choice_training_events',[],/permission denied/)
        await reject(db,start,[ou,'cases1','["A","B"]'],/permission denied/)
        await db.exec('RESET ROLE; SET ROLE service_role')
        assert.equal((await db.query('select count(*)::int n from ag_choice_training_events where user_id=$1',[ou])).rows[0].n,4);passed++
        await db.exec('RESET ROLE')
        await db.query('delete from auth.users where id=$1',[ou])
        assert.equal((await db.query('select count(*)::int n from ag_onboarding_progress where user_id=$1',[ou])).rows[0].n,0);passed++
    }
    // 실제 HTTP A* 응답을 같은 SQL로 저장→노출→선택→학습 view까지 왕복한다. 원격에는 시험 행을 만들지 않는다.
    if (process.argv[3]) {
        const fixture=JSON.parse(readFileSync(resolve(process.argv[3]),'utf8'))
        assert.equal(fixture.test_only,true)
        const fu=randomUUID(),sId=randomUUID(),res=fixture.response,req=fixture.request
        await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,'{\"provider\":\"google\"}')",[fu,'worker@example.test'])
        const fp=(await db.query(savePref,[fu,'daily',JSON.stringify(req.ranks),req.max_detour_minutes])).rows[0].value
        assert.deepEqual(fp.effective_weights,res.profile_weights)
        const bySegments=new Map()
        for(const type of ['shortestTime','shortestDistance','safe']) {
            const candidate=res[type],key=JSON.stringify(candidate.segments)
            if(bySegments.has(key))bySegments.get(key).route_types.push(type)
            else bySegments.set(key,{...candidate,candidate_id:randomUUID(),search_id:sId,user_id:fu,release_id:release,profile_version:fp.profile_version,model_version:'survey_only_v1',display_duration_s:Math.round(candidate.internal_duration_s/60)*60,display_duration_source:'INTERNAL_HOURLY',route_types:[type]})
        }
        const actual={search:{search_id:sId,release_id:release,profile_version:fp.profile_version,model_version:'survey_only_v1',departure_at:res.departure_at,origin:req.origin,destination:req.destination,max_detour_minutes:req.max_detour_minutes,minimum_internal_duration_s:res.minimum_internal_duration_s,
            profile_snapshot:{profile_version:fp.profile_version,survey_version:fp.survey_version,effective_weights:fp.effective_weights},versions:{...versions},sample_origin:'service'},candidates:[...bySegments.values()]}
        await db.query(save,[fu,JSON.stringify(actual)])
        const eid=randomUUID(),ids=actual.candidates.map(c=>c.candidate_id)
        await db.query(expose,[fu,sId,eid,JSON.stringify(ids),ids[0]])
        await db.query(choose,[fu,eid,randomUUID(),ids[0]])
        const exported=(await db.query('select * from ag_choice_training_events where user_id=$1',[fu])).rows[0]
        writeFileSync(new URL('../.test-tools/learning-choice-fixture.json',import.meta.url),JSON.stringify({test_only:true,event:exported},null,2))
        assert.deepEqual(exported.snapshots.map(c=>c.candidate_id),ids)
        assert.deepEqual(exported.snapshots.map(c=>c.raw_features),actual.candidates.map(c=>c.raw_features))
        assert.deepEqual(exported.profile_weights,res.profile_weights)
        assert.equal(exported.sample_origin,'service')
        await db.query('delete from auth.users where id=$1',[fu])
        passed+=6
    }
    const model = 'test_logistic_v1', hash = 'a'.repeat(64)
    const scaler={scale_version:'scale1',feature_version:versions.feature_version,fit_split:'train',fit_manifest_sha256:hash,values:[60,100,1,100,100,1,1,100]}
    await db.exec('update ag_model_versions set is_active=false')
    await db.query(`insert into ag_model_versions(model_version,model_type,contract_version,feature_version,eta_version,scale_version,scaler,artifact_path,artifact_sha256,training_manifest_sha256,is_active)
        values($1,'logistic',$2,$3,$4,'scale1',$5::jsonb,'TEST_ONLY/model',$6,$6,true)`,[model,versions.contract_version,versions.feature_version,versions.eta_version,JSON.stringify(scaler),hash])
    const job = randomUUID()
    await db.query('insert into ag_profile_update_jobs(job_id,user_id,input_profile_version,model_version,history_cutoff,sample_search_count) values($1,$2,$3,$4,now(),8)',[job,user,pref.profile_version,model])
    const apply = 'select ag_apply_profile_update($1,$2::jsonb,$3,$4,$5::jsonb) value'
    await reject(db,apply,[job,'[0.5,0.4,0.1,0,0,0]',0.7,0.6,'{}'],/INDIFFERENT/)
    const updated = (await db.query(apply,[job,'[0.6,0.4,0,0,0,0]',0.7,0.6,'{"test_only":true}'])).rows[0].value
    assert.equal((await db.query(apply,[job,'[0.5,0.5,0,0,0,0]',0.7,0.5,'{}'])).rows[0].value, updated)
    passed++
    const staleJob = randomUUID()
    await db.query('insert into ag_profile_update_jobs(job_id,user_id,input_profile_version,model_version,history_cutoff,sample_search_count) values($1,$2,$3,$4,now(),8)',[staleJob,user,pref.profile_version,model])
    assert.equal((await db.query(apply,[staleJob,'[0.6,0.4,0,0,0,0]',0.7,0.6,'{}'])).rows[0].value,null)
    passed++
    await db.query('select ag_reset_profile($1,false)',[user])
    assert.equal((await db.query('select personalization_enabled from ag_user_profiles where user_id=$1',[user])).rows[0].personalization_enabled,false)
    assert.deepEqual((await db.query('select snapshot from ag_candidates where candidate_id=$1',[ids[0]])).rows[0].snapshot.profile_weights,pref.effective_weights)
    passed+=2
    await db.exec(sql)
    assert.equal((await db.query('select count(*)::int n from ag_choices')).rows[0].n,1)
    assert.equal((await db.query('select model_version from ag_model_versions where is_active')).rows[0].model_version,model)
    passed+=2
    await db.query('delete from auth.users where id=$1',[user])
    assert.equal((await db.query('select count(*)::int n from ag_choices')).rows[0].n,0)
    assert.equal((await db.query('select count(*)::int n from ag_profile_versions where user_id=$1',[user])).rows[0].n,0)
    passed+=2
} finally { await db.close() }

for (const previous of ['20260901_handle_new_user_trigger.sql','20260905_handle_new_user_trigger.sql']) {
    const legacy = await setup(previous)
    try { await legacy.exec(sql); assert.equal((await legacy.query("select count(*)::int n from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal")).rows[0].n,2); passed++ }
    finally { await legacy.close() }
}
const unknown = await setup()
try {
    await unknown.exec('create function public.handle_new_user() returns trigger language plpgsql as $$ begin return new; end $$;')
    await assert.rejects(unknown.exec(sql),/UNKNOWN_AUTH_TRIGGER/)
    await unknown.exec('ROLLBACK')
    assert.equal((await unknown.query("select to_regclass('public.ag_choices') name")).rows[0].name,null)
    passed++
} finally { await unknown.close() }
const incompatible = await setup()
try {
    await incompatible.exec('create table ag_nodes(node_id bigint)')
    await assert.rejects(incompatible.exec(sql), /INCOMPATIBLE_AG_SCHEMA/)
    await incompatible.exec('ROLLBACK')
    assert.equal((await incompatible.query("select to_regclass('public.ag_choices') name")).rows[0].name, null)
    passed++
} finally { await incompatible.close() }
console.log(JSON.stringify({passed,engine:'PGlite 0.5.8',scope:'real migration with baseline users/auth fixture; no hosted Supabase or PostGIS integration'},null,2))
