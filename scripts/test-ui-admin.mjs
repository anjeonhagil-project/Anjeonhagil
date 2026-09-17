// 임시 계정으로 관리자 조회·필터·상세·비공개 공지·테스트 문의 답변을 검증하고 정리한다.
import {chromium} from 'playwright'
import{createClient}from'@supabase/supabase-js'
import{parse}from'dotenv'
import{readFileSync,writeFileSync,mkdirSync}from'node:fs'
import{randomUUID,randomBytes}from'node:crypto'
import assert from'node:assert/strict'
const env=parse(readFileSync('apps/backend/.env'))
const client=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const email='ag-admin-ui-'+randomUUID()+'@example.test',password=randomBytes(24).toString('base64url')
const base=process.argv.find(v=>v.startsWith('--url='))?.slice(6)||'http://localhost:5174'
let id,browser,page,noticeId;let passed=10;const errors=[],failures=[]
mkdirSync('.test-tools/ui-results',{recursive:true})
try{
    const created=await client.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nickname:'화면검증',username:'agadmin'+randomBytes(4).toString('hex')}})
    if(created.error)throw new Error('TEST_ACCOUNT_FAILED')
    id=created.data.user.id
    const grant=await client.from('admins').insert({id,email,role:'super_admin',is_active:true})
    if(grant.error)throw new Error('TEST_ADMIN_FAILED')
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
    page=await browser.newPage({viewport:{width:1440,height:1000},locale:'ko-KR'})
    page.on('pageerror',e=>errors.push(e.message))
    page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)failures.push({path:new URL(r.url()).pathname,status:r.status()})})
    await page.goto(base+'/login')
    await page.getByLabel('관리자 이메일').fill(email);await page.getByLabel('비밀번호',{exact:true}).fill(password)
    await page.getByRole('button',{name:'관리자 로그인',exact:true}).click()
    await page.waitForURL('**/dashboard')
    await page.getByText('계산기: 정상 응답',{exact:true}).waitFor()
    await page.getByRole('link',{name:'관리자 관리',exact:true}).waitFor()
    await page.getByRole('link',{name:'경로 검색 기록',exact:true}).waitFor()
    await page.locator('.ops-chart-total').waitFor({timeout:60000})
    await page.getByRole('button',{name:'이번 달',exact:true}).click()
    await page.locator('.ops-chart-total').waitFor({timeout:60000});passed++
    await page.getByRole('button',{name:'올해',exact:true}).click()
    await page.locator('.ops-chart-total').waitFor({timeout:60000});passed++
    await page.screenshot({path:'.test-tools/ui-results/06-admin-dashboard.png',fullPage:true})
    for(const [path,heading] of [['routes','경로 검색 기록'],['datasets','데이터·모델 관리'],['datasets/failure','경로 계산 실패'],['admins','관리자 관리']]){
        await page.goto(base+'/'+path);await page.getByRole('main').getByRole('heading',{name:heading,exact:true}).waitFor()
        await page.waitForFunction(()=>![...document.querySelectorAll('p')].some(p=>p.textContent==='불러오는 중…'))
        assert.equal(await page.getByRole('alert').count(),0)
    }
    for(const path of ['members','notices','inquiries']){await page.goto(base+'/'+path);await page.waitForLoadState('networkidle');assert.equal(await page.getByRole('alert').count(),0)}
    await page.goto(base+'/datasets')
    await page.getByRole('button',{name:'상세 보기',exact:true}).first().click()
    await page.getByRole('dialog').waitFor()
    await page.screenshot({path:'.test-tools/ui-results/07-admin-data-detail.png',fullPage:true})
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);passed++
    const failure=await client.from('ag_route_failures').insert({user_id:id,search_id:randomUUID(),error_code:'UI_TEST_ONLY',duration_ms:125})
    assert.equal(failure.error,null)
    await page.goto(base+'/datasets/failure')
    await page.getByLabel('기록 검색').fill('UI_TEST_ONLY')
    await page.getByRole('button',{name:'상세 보기',exact:true}).first().waitFor()
    await page.getByRole('button',{name:'상세 보기',exact:true}).first().click()
    await page.getByRole('dialog').getByText('UI_TEST_ONLY',{exact:true}).waitFor();passed++
    await page.keyboard.press('Escape')
    await page.getByLabel('기록 검색').fill('no_matching_fixture')
    await page.getByText('조건에 맞는 기록이 없습니다',{exact:true}).waitFor();passed++
    await page.goto(base+'/admins')
    await page.getByLabel('관리자 검색').fill(email)
    await page.getByRole('button',{name:'비활성화',exact:true}).click()
    await page.getByRole('dialog').waitFor()
    await page.getByRole('button',{name:'취소',exact:true}).click();passed++
    const title='UI draft '+randomUUID()
    await page.goto(base+'/notices/new')
    await page.getByLabel('공지 제목',{exact:false}).fill(title)
    await page.getByLabel('공지 내용',{exact:false}).fill('Automated draft only. Removed after verification.')
    assert.equal(await page.getByLabel('공개 설정').inputValue(),'false')
    await page.getByRole('button',{name:'등록',exact:true}).click()
    await page.getByRole('heading',{name:'공지사항 등록 완료',exact:true}).waitFor()
    const saved=await client.from('notices').select('id,is_published').eq('title',title).single()
    assert.equal(saved.error,null);noticeId=saved.data.id;assert.equal(saved.data.is_published,false);passed++
    const inquiry=await client.from('inquiries').insert({user_id:id,category:'service',title:'UI temporary inquiry',content:'Isolated test account only.',status:'received'}).select('id').single()
    assert.equal(inquiry.error,null)
    await page.goto(base+'/inquiries/'+inquiry.data.id)
    await page.getByPlaceholder('문의에 대한 답변을 입력해주세요.').fill('Automated test reply for this temporary account only.')
    await page.getByRole('button',{name:'답변 등록',exact:true}).click()
    await page.getByRole('heading',{name:'답변 등록 완료',exact:true}).waitFor()
    const answered=await client.from('inquiries').select('status,answer_content').eq('id',inquiry.data.id).single()
    assert.equal(answered.data.status,'answered');assert.ok(answered.data.answer_content.includes('Automated test reply'));passed++
    await page.goto(base+'/members');await page.waitForLoadState('networkidle')
    await page.screenshot({path:'.test-tools/ui-results/08-admin-members.png',fullPage:true})
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[])
    const report={passed,errors,failures,scope:'real admin browser, chart periods, filters, dialogs, unpublished draft and isolated inquiry; temporary records cleaned'}
    writeFileSync('.test-tools/ui-results/admin-report.json',JSON.stringify(report,null,2));console.log(report)
}catch(error){if(page){await page.screenshot({path:'.test-tools/ui-results/admin-failure.png',fullPage:true}).catch(()=>{});writeFileSync('.test-tools/ui-results/admin-failure.json',JSON.stringify({message:error.message,url:page.url(),errors,failures},null,2))}throw error}
finally{await browser?.close();if(id){const r=await client.from('notices').delete().eq('created_by',id);if(r.error)console.error('TEST_NOTICE_CLEANUP_FAILED',id);const deleted=await client.auth.admin.deleteUser(id);if(deleted.error)console.error('TEST_ACCOUNT_CLEANUP_FAILED',id)}}
