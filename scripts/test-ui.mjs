// 별도 Chrome 프로필로 실제 로그인·약관·설문·지도·추천·선택·새로고침을 검사한다. 실제 사용자 브라우저를 변경하지 않는다.
import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'
import {parse} from 'dotenv'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {randomUUID,randomBytes} from 'node:crypto'
import assert from 'node:assert/strict'
const env=parse(readFileSync('apps/backend/.env'))
const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const base=process.argv.find(v=>v.startsWith('--url='))?.slice(6)||'http://localhost:5173'
const email='ag-ui-'+randomUUID()+'@example.test',password=randomBytes(24).toString('base64url')
const out='.test-tools/ui-results';mkdirSync(out,{recursive:true})
let userId,browser,page,passed=0
const errors=[],providerFailures=[]
async function assertPageScroll(url,label){
    if(url)await page.goto(url)
    await page.waitForFunction(()=>[...document.querySelectorAll('*')].some(el=>{
        const style=getComputedStyle(el)
        return ['auto','scroll'].includes(style.overflowY)&&el.scrollHeight>el.clientHeight+8
    }),{timeout:10000})
    const found=await page.evaluate(()=>{
        document.querySelectorAll('[data-scroll-audit]').forEach(el=>el.removeAttribute('data-scroll-audit'))
        const candidates=[...document.querySelectorAll('*')].filter(el=>{
            const style=getComputedStyle(el)
            return ['auto','scroll'].includes(style.overflowY)&&el.scrollHeight>el.clientHeight+8
        }).sort((a,b)=>(b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))
        if(!candidates[0])return null
        candidates[0].dataset.scrollAudit='true';candidates[0].scrollTop=0
        return {clientHeight:candidates[0].clientHeight,scrollHeight:candidates[0].scrollHeight}
    })
    assert.ok(found,`${label}: scroll container missing`)
    const target=page.locator('[data-scroll-audit="true"]');await target.hover();await page.mouse.wheel(0,700);await page.waitForTimeout(200)
    assert.ok(await target.evaluate(el=>el.scrollTop)>0,`${label}: user wheel did not move content`)
    passed++
}
try{
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nickname:'화면검증',username:'agui'+randomBytes(5).toString('hex')}})
    if(created.error)throw new Error('UI test account creation failed: '+created.error.code)
    userId=created.data.user.id
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
    const context=await browser.newContext({viewport:{width:1280,height:1000},locale:'ko-KR'})
    page=await context.newPage();page.setDefaultTimeout(30000)
    page.on('pageerror',e=>errors.push(e.message))
    page.on('response',r=>{const host=new URL(r.url()).hostname;if(r.status()>=400&&/kakao|daum/.test(host))providerFailures.push({host,status:r.status()})})
    await page.goto(base+'/login')
    await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill(password)
    await page.getByRole('button',{name:'로그인',exact:true}).click()
    await page.waitForURL('**/terms');passed++
    await page.getByRole('button',{name:/^전체 동의/}).click()
    await page.getByRole('button',{name:'동의하고 가입 완료',exact:true}).click()
    await page.waitForURL('**/location-permission')
    await page.getByRole('button',{name:'출발지를 직접 입력할게요'}).click()
    await page.getByRole('button',{name:'시작하기',exact:true}).click()
    await page.getByLabel('운전 빈도').selectOption('daily')
    const ranks=['2','0','1','0','0','3']
    for(let i=0;i<6;i++)await page.locator('select').nth(i+1).selectOption(ranks[i])
    assert.equal(await page.getByText(/^Q3\./).count(),0);passed++
    await page.setViewportSize({width:390,height:430});await assertPageScroll(null,'온보딩 설문');await page.setViewportSize({width:1280,height:1000})
    await page.screenshot({path:out+'/01-survey.png',fullPage:true})
    await page.getByRole('button',{name:'다음',exact:true}).click()
    for(let i=0;i<4;i++){
        await page.getByText('경로 비교 설문 '+(i+1)+' / 4',{exact:true}).waitFor()
        if(i===0){await page.locator('.q4-options').waitFor();await page.screenshot({path:out+'/02-q4.png',fullPage:true})}
        if(i===2)await page.getByRole('button',{name:'판단하기 어려워요',exact:true}).click()
        else await page.locator('.q4-option').nth(i%2).click()
        await page.getByRole('button',{name:i===3?'설정 완료':'다음 문항',exact:true}).click();passed++
    }
    await page.getByRole('button',{name:'안전하길 시작하기',exact:true}).click()
    await page.waitForURL('**/home');passed++
    await page.getByLabel('장소 검색어').fill('언주역')
    await page.getByRole('list',{name:'장소 검색 결과'}).getByRole('button').first().click()
    await page.getByRole('button',{name:'즐겨찾기에 추가',exact:true}).click()
    await page.getByRole('button',{name:'즐겨찾기에서 삭제',exact:true}).waitFor();passed++
    await page.goto(base+'/favorites')
    await page.getByRole('button',{name:'➤ 경로 찾기',exact:true}).first().click()
    await page.waitForURL('**/search')
    assert.ok((await page.getByPlaceholder('목적지 입력',{exact:true}).inputValue()).includes('언주'));passed++
    await page.getByPlaceholder('출발지 입력 (미입력 시 현위치)').fill('역삼역')
    await page.getByRole('list',{name:'장소 검색 결과'}).getByRole('button').first().click();passed++
    await page.goto(base+'/search')
    await page.getByRole('button',{name:'예시 구간 A',exact:true}).click()
    await page.locator('.route-card').first().waitFor({timeout:60000})
    const choose=page.getByRole('button',{name:'이 경로 선택하기',exact:true})
    await choose.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='이 경로 선택하기'&&!b.disabled))
    const cardCount=await page.locator('.route-card').count();assert.ok(cardCount>=1&&cardCount<=3);passed++
    assert.equal(await page.locator('.route-badge').count(),1);passed++
    if(cardCount>1){assert.equal(await page.locator('.route-card').getByText(/^최단시간 후보 대비/).count(),cardCount-1);passed++}
    await page.waitForFunction(()=>Boolean(window.kakao?.maps?.Map),{timeout:30000});passed++
    await page.screenshot({path:out+'/03-route-comparison.png',fullPage:true})
    await choose.click();await page.getByText('경로 선택을 저장했어요',{exact:true}).waitFor();passed++
    const savedUrl=page.url();assert.ok(savedUrl.includes('search='))
    await page.reload();await page.getByText('경로 선택을 저장했어요',{exact:true}).waitFor();passed++
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/04-mobile-selected-route.png',fullPage:true})
    await page.setViewportSize({width:390,height:430})
    await assertPageScroll(savedUrl,'선택 경로')
    await assertPageScroll(base+'/my','마이페이지')
    await assertPageScroll(base+'/my/driving-preferences','운전 부담 설정')
    await assertPageScroll(base+'/my/support','도움말')
    await assertPageScroll(base+'/terms/service','긴 약관')
    await page.setViewportSize({width:390,height:844})
    await page.goto(base+'/my/driving-preferences')
    await page.getByText('행동 개인화',{exact:false}).waitFor();passed++
    await page.screenshot({path:out+'/05-personalization.png',fullPage:true})
    const choices=await admin.from('ag_choices').select('*',{count:'exact',head:true}).eq('user_id',userId)
    const q4=await admin.from('ag_q4_sessions').select('session_id').eq('user_id',userId).single()
    const answers=await admin.from('ag_q4_responses').select('answer').eq('session_id',q4.data.session_id)
    assert.equal(choices.count,1);assert.equal(answers.data.length,4);assert.ok(answers.data.some(a=>a.answer==='UNSURE'));passed+=3
    assert.deepEqual(errors,[]);assert.deepEqual(providerFailures,[]);passed+=2
    const report={passed,cardCount,providerFailures,pageErrors:errors,scope:'real Chrome + local API + Supabase, temporary account'}
    writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(report)
}catch(error){
    if(page){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});writeFileSync(out+'/failure.txt',error.message+'\n'+page.url()+'\n'+JSON.stringify({errors,providerFailures}))}
    throw error
}finally{
    await browser?.close()
    if(userId){await new Promise(r=>setTimeout(r,1500));const {error}=await admin.auth.admin.deleteUser(userId);if(error)console.error('UI test account cleanup failed:',userId,error.code)}
}
