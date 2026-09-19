// 새 PC의 실행 준비 상태만 검사한다. 키·접속 문자열은 출력하지 않고 DB는 변경하지 않는다.
import {existsSync,readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {parse} from 'dotenv'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
let failures=0
const check=(ok,label)=>{console.log(`${ok?'OK':'FAIL'} ${label}`);if(!ok)failures++}
const env=name=>{const p=path.join(root,'apps',name,'.env');check(existsSync(p),`${name}/.env`);return existsSync(p)?parse(readFileSync(p)):{} }
check(Number(process.versions.node.split('.')[0])>=24,'Node.js 24 이상')
const backend={...env('backend'),...process.env}
for(const key of ['SUPABASE_URL','SUPABASE_SECRET_KEY','KAKAO_REST_API_KEY'])check(!!backend[key],`backend ${key} 설정`)
for(const app of ['frontend_mobile','frontend_admin']){
    const values=env(app)
    for(const key of ['VITE_SUPABASE_URL',...(app==='frontend_mobile'?['VITE_KAKAO_JS_KEY']:[])])check(!!values[key],`${app} ${key} 설정`)
    check(!!(values.VITE_SUPABASE_ANON_KEY||values.VITE_SUPABASE_PUBLISHABLE_KEY),`${app} Supabase 공개키 설정`)
    check(!!values.VITE_SUPABASE_URL&&values.VITE_SUPABASE_URL.replace(/\/$/,'')===backend.SUPABASE_URL?.replace(/\/$/,''),`${app} Supabase 프로젝트 일치`)
    let safe=true
    for(const [key,value] of Object.entries(values).filter(([k])=>k.startsWith('VITE_'))){
        if(/SECRET|SERVICE_ROLE|DATABASE_URL|PASSWORD/.test(key)||value.startsWith('sb_secret_')||value===backend.SUPABASE_SECRET_KEY)safe=false
        if(value.split('.').length===3){try{if(JSON.parse(Buffer.from(value.split('.')[1],'base64url')).role==='service_role')safe=false}catch{}}
    }
    check(safe,`${app} 공개 설정에 서버 비밀키 없음`)
}
const python=path.join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python')
const p=spawnSync(python,['-c','import sys,numpy,shapely,pyproj,psycopg,sklearn,xgboost,pandas,scipy; assert sys.version_info[:2] == (3,12)'],{cwd:root,encoding:'utf8',windowsHide:true})
check(p.status===0,'Python 3.12 및 모델/DB 의존성 (실패 시 scripts/setup-python.ps1)')
const data=spawnSync(process.execPath,['scripts/verify-routing-data.mjs'],{cwd:root,encoding:'utf8',windowsHide:true})
check(data.status===0,'도로·경계·실행 코드 해시/SQLite 무결성 (실패 시 npm run verify:data)')
for(const file of ['ml/bundled/logistic.json','ml/bundled/xgboost.json','apps/backend/src/config/q4Cases.json'])check(existsSync(path.join(root,file)),file)
if(process.argv.includes('--db')){
    const result=spawnSync(python,['-X','utf8','database/manage.py','status'],{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONUTF8:'1'}})
    let s;try{s=JSON.parse(result.stdout).status}catch{}
    // 추가 테이블은 허용하되, 현재 서비스가 사용하는 필수 테이블은 모두 확인한다.
    const requiredTables=[
        'ag_dataset_releases','ag_dataset_active','ag_model_versions',
        'ag_preference_history','ag_preferences','ag_profile_versions','ag_user_profiles',
        'ag_profile_update_jobs','ag_onboarding_progress','ag_searches','ag_candidates',
        'ag_exposures','ag_choices','ag_q4_sessions','ag_q4_responses','ag_route_failures',
        'ag_q4_profiles','ag_personalization_queue','ag_q4_retake_requests','ag_q4_trial_estimates',
    ]
    const missingTables=requiredTables.filter(name=>!s?.tables?.includes(name))
    check(result.status===0&&missingTables.length===0,'원격 DB: 필수 서비스 테이블'+(missingTables.length?' (누락: '+missingTables.join(', ')+')':''))
    check(result.status===0&&s?.active_release?.length===1&&s?.active_model?.length===1&&s?.unvalidated_constraints?.length===0&&s?.rls_disabled?.length===0&&s?.local_release_matches&&s?.local_model_matches,'원격 DB: 활성 데이터/모델 해시 일치·제약·RLS')
    check(s?.missing_core_tables?.length===0&&s?.browser_table_access?.length===0&&s?.missing_service_read?.length===0,'기존 22개 테이블·서버 조회 권한·브라우저 직접 접근 차단')
}
console.log(failures?`${failures}개 항목을 준비한 뒤 다시 검사하세요. 비밀 설정은 .env.example을 참고하세요.`:'실행 준비 검사 통과. 카카오 허용 도메인과 소셜 로그인 설정은 공급자 콘솔에서도 확인하세요.')
process.exitCode=failures?1:0
