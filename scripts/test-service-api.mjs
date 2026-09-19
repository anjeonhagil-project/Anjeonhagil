// 로컬 API와 실제 Supabase를 임시 계정으로 검증한다. 생성한 계정/연관 데이터는 finally에서 정리한다.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {randomUUID,randomBytes} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {parse} from 'dotenv'
const env=parse(readFileSync('apps/backend/.env'))
const options={auth:{persistSession:false,autoRefreshToken:false}}
const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,options)
const base=process.argv.find(v=>v.startsWith('--api-url='))?.slice(10)||process.env.TEST_API_URL||'http://localhost:3000/api'
const users=[];let passed=0
async function account(){
    const email='agtest-'+randomUUID()+'@example.test',password=randomBytes(24).toString('base64url')
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nickname:'검증계정',username:'agtest'+randomBytes(4).toString('hex')}})
    if(error)throw new Error('Test account creation failed: '+error.code)
    users.push(data.user.id)
    const client=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,options)
    const login=await client.auth.signInWithPassword({email,password})
    if(login.error)throw new Error('Test sign in failed: '+login.error.code)
    return {id:data.user.id,token:login.data.session.access_token}
}
async function call(path,token,method='GET',body,expected=200){
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)})
    const result=await r.json()
    assert.equal(r.status,expected,path+' '+JSON.stringify(result.error||{}));passed++
    return result.data
}
try{
    await call('/health')
    await call('/routes/searches',null,'GET',undefined,401)
    const user=await account(),other=await account()
    await call('/users/me/terms',user.token,'PUT',{agreed:true})
    const answers={drivingFrequency:'daily',ranks:[2,0,1,0,0,3]}
    await call('/driving-preferences',user.token,'PUT',{...answers,maxDetourMinutes:5},400)
    const preferences=await call('/driving-preferences',user.token,'PUT',answers)
    assert.equal(preferences.onboarding.routeChoicesCompleted,false);passed++
    const q4=await call('/driving-preferences/q4',user.token)
    assert.equal(q4.questions.length,4);assert.deepEqual(q4.questions.map(q=>q.dimension),['TIME','DISTANCE','TIME','DISTANCE']);passed+=2
    for(let i=0;i<4;i++)await call('/driving-preferences/q4',user.token,'POST',{sessionId:q4.session_id,questionIndex:i,answer:q4.questions[i].routes.find(r=>r.route_key===q4.questions[i].lower_burden_route_key).label})
    const initial=await call('/driving-preferences/personalization',user.token)
    assert.equal(initial.q4.training.status,'TRIAL_ONLY');assert.equal(initial.q4.policy.version,'q4_bounded_rerank_20260919_v1');passed+=2
    await call('/driving-preferences/q4/settings',user.token,'PATCH',{enabled:'yes'},400)
    const repeated=await call('/driving-preferences/q4',user.token)
    assert.equal(repeated.q4Profile.sessionId,q4.session_id);passed++
    const me=await call('/users/me',user.token);assert.equal(me.onboarding,true);passed++
    const q4choices=await admin.from('ag_choices').select('*',{count:'exact',head:true}).eq('user_id',user.id)
    assert.equal(q4choices.count,0);passed++
    const fixture=JSON.parse(readFileSync('apps/backend/routing/tools/examples/hourly_search.json'))
    const input={searchId:randomUUID(),origin:fixture.origin,destination:fixture.destination,departureAt:'2026-09-16T08:00:00+09:00'}
    await call('/routes/searches',user.token,'POST',{...input,raw_features:[0,0,0,0,0,0]},400)
    const cancelled=new AbortController(),timer=setTimeout(()=>cancelled.abort(),500)
    try {
        await assert.rejects(fetch(base+'/routes/searches',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+user.token},body:JSON.stringify(input),signal:cancelled.signal}),e=>e.name==='AbortError');passed++
    } finally {clearTimeout(timer)}
    await new Promise(r=>setTimeout(r,1000))
    const cancelledSearch=await admin.from('ag_searches').select('search_id').eq('search_id',input.searchId)
    assert.ifError(cancelledSearch.error);assert.equal(cancelledSearch.data.length,0);passed++
    // Reuse the same identifier after cancellation; no late result may be selected or saved.
    const result=await call('/routes/searches',user.token,'POST',input)
    assert.ok(result.candidates.length>=1&&result.candidates.length<=3);passed++
    const burdenPath='/routes/searches/'+result.searchId+'/candidates/'+result.candidates[0].candidate_id+'/burden'
    await call(burdenPath,other.token,'GET',undefined,404)
    const explanation=await call(burdenPath,user.token)
    assert.ok(explanation.totals.every((v,i)=>Math.abs(v-result.candidates[0].raw_features[i])<1e-6));passed++
    await call('/routes/searches/'+result.searchId+'/candidates/'+randomUUID()+'/burden',user.token,'GET',undefined,404)
    const recovered=await call('/routes/searches/'+result.searchId,user.token)
    assert.deepEqual(recovered.candidates,result.candidates);passed++
    assert.equal(result.q4.policy.version,'q4_bounded_rerank_20260919_v1');assert.equal(result.q4.sessionId,q4.session_id)
    assert.deepEqual(recovered.q4,result.q4);passed+=3
    const off=await call('/driving-preferences/q4/settings',user.token,'PATCH',{enabled:false})
    assert.equal(off.q4.enabled,false)
    const past=await call('/routes/searches/'+result.searchId,user.token)
    assert.equal(past.q4.enabled,true);passed+=2
    await call('/driving-preferences/q4/settings',user.token,'PATCH',{enabled:true})
    await call('/routes/searches/'+result.searchId,other.token,'GET',undefined,404)
    await call('/routes/searches/'+result.searchId+'/guidance',other.token,'GET',undefined,404)
    await call('/routes/searches/'+result.searchId+'/guidance',user.token,'GET',undefined,409)
    const exposureId=randomUUID(),exposure={exposureId,candidateIds:result.candidates.map(c=>c.candidate_id),recommendedCandidateId:result.recommendedCandidateId,context:{policy:'visible_cards_v2',selectionSource:'card',selectionChanges:0}}
    await call('/routes/searches/'+result.searchId+'/exposures',user.token,'POST',exposure,201)
    await call('/routes/searches/'+result.searchId+'/exposures',user.token,'POST',exposure,201)
    const choice={choiceEventId:randomUUID(),selectedCandidateId:result.recommendedCandidateId}
    await call('/routes/exposures/'+exposureId+'/choices',user.token,'POST',choice,201)
    const guidance=await call('/routes/searches/'+result.searchId+'/guidance',user.token)
    assert.deepEqual(guidance.geometry,result.candidates.find(c=>c.candidate_id===choice.selectedCandidateId).geometry);passed++
    await call('/routes/exposures/'+exposureId+'/choices',user.token,'POST',choice,201)
    const history=await call('/routes/searches',user.token);assert.equal(history[0].choice.selected_candidate_id,result.recommendedCandidateId);passed++
    await call('/admin/operations/summary',user.token,'GET',undefined,403)
    const inquiries=await call('/inquiries',user.token);assert.equal(inquiries.length,0);passed++
    await call('/inquiries',user.token,'POST',{title:'자동 검증용 문의',content:'테스트 종료 시 임시 계정과 함께 삭제됩니다.',category:'other'},201)
    assert.equal((await call('/inquiries',user.token)).length,1);passed++
    await call('/notices',user.token)
    const state=await call('/driving-preferences/personalization',user.token)
    const reset=await call('/driving-preferences/personalization/reset',user.token,'POST',{enabled:false})
    assert.notEqual(reset.profileVersion,state.profileVersion);assert.equal(reset.enabled,false);passed+=2
    const after=await call('/routes/searches/'+result.searchId,user.token)
    assert.deepEqual(after.profile,result.profile);passed++
    // 일반 사용자로 관리자 API를 통과하지 못함을 먼저 확인한 뒤 임시 계정에 테스트용 admin만 부여한다.
    const {error:grantError}=await admin.from('admins').insert({id:other.id,email:'test-admin-'+other.id+'@example.test',role:'admin',is_active:true})
    if(grantError)throw new Error('Test admin setup failed: '+grantError.code)
    const summary=await call('/admin/operations/summary',other.token)
    assert.ok(summary.counts.searches>=1&&summary.counts.choices>=1);passed++
    await call('/admin/operations/routes',other.token)
    await call('/admin/operations/failures',other.token)
    const restart=await call('/driving-preferences/q4/restart',user.token,'POST',{})
    assert.equal(restart.surveyVersion,initial.surveyVersion)
    assert.equal((await call('/driving-preferences/personalization',user.token)).q4.pending,true)
    assert.deepEqual((await call('/routes/searches/'+result.searchId,user.token)).q4,result.q4);passed+=3
    const report={passed,scope:'local HTTP and remote Supabase with disposable accounts',routingSeconds:result.diagnostics.elapsed_seconds,candidates:result.candidates.length,q4Separated:true}
    writeFileSync('.test-tools/service-api-report.json',JSON.stringify(report,null,2));console.log(report)
}finally{
    // 비동기 프로필 작업이 끝나거나 보류될 시간을 준다. 실제 계정에는 접근하지 않는다.
    await new Promise(r=>setTimeout(r,1500))
    for(const id of users){const {error}=await admin.auth.admin.deleteUser(id);if(error)console.error('Disposable account cleanup failed:',id,error.code)}
}
