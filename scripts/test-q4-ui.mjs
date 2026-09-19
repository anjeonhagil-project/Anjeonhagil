// Real React/Chromium, deterministic API fixtures. No hosted writes or live map claim.
import {createServer} from 'vite'
import react from '@vitejs/plugin-react'
import {chromium} from 'playwright'
import {readFileSync,mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import Preferences from '/src/features/my/DrivingPreferencesPage.jsx';import Onboarding from '/src/features/onboarding/OnboardingPage.jsx';import Notice from '/src/features/my/SurveySavedNotice.jsx';import '/src/styles/global.css';const entry=new URLSearchParams(location.search).get('entry')||'/my/driving-preferences';const app=React.createElement(MemoryRouter,{initialEntries:[entry]},React.createElement(Routes,null,React.createElement(Route,{path:'/my/driving-preferences',element:React.createElement(Preferences)}),React.createElement(Route,{path:'/onboarding',element:React.createElement(Onboarding)}),React.createElement(Route,{path:'/my',element:React.createElement(React.Fragment,null,React.createElement('h1',null,'마이페이지'),React.createElement(Notice))})));createRoot(document.getElementById('root')).render(app);</script></html>`
const server=await createServer({root:'apps/frontend_mobile',configFile:false,plugins:[react(),{name:'q4-test-page',configureServer(s){s.middlewares.use('/__q4_test',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__q4_test',html))})}}],server:{host:'127.0.0.1',port:5189,strictPort:true}})
let browser,passed=0
try{
    await server.listen();browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    const bank=JSON.parse(readFileSync('apps/backend/src/config/q4Cases.json','utf8'))
    const session={session_id:'12345678-1234-1234-1234-123456789012',questions:bank.cases.COMPLEX_INTERSECTION.map(q=>({...q,routes:q.routes.map((r,i)=>({...r,label:i?'B':'A'}))})),reference_factor:'COMPLEX_INTERSECTION',reference_source:'Q2_TOP',answers:[],completed_at:'complete',q4AffectsRecommendation:true}
    let revision=1,pending=false,failNext=false,failSave=false,failProfile=true,saveCount=0,preferences={surveyVersion:'survey',drivingFrequency:'daily',ranks:[1,0,0,0,0,0]}
    const profile=()=>({enabled:true,effectiveWeights:[1,0,0,0,0,0],q4:{status:session.completed_at?'COMPLETE':'INCOMPLETE',enabled:true,applicable:false,pending,revision}})
    await page.route('**/*',async route=>{
        const req=route.request(),url=new URL(req.url()),path=url.pathname
        if(path.includes('/driving-preferences')){
            let data
            if(path.endsWith('/personalization')){if(failProfile){failProfile=false;return route.fulfill({status:503,json:{success:false,error:{message:'선호 조회 오류'}}})}data=profile()}
            else if(path.endsWith('/q4/restart')){pending=true;session.answers=[];session.completed_at=null;data={surveyVersion:preferences.surveyVersion}}
            else if(path.endsWith('/q4')&&req.method()==='GET')data=session
            else if(path.endsWith('/q4')){
                if(failNext){failNext=false;return route.fulfill({status:503,json:{success:false,error:{message:'일시적인 저장 오류'}}})}
                const body=req.postDataJSON();assert.equal(body.questionIndex,session.answers.length);session.answers.push({question_index:body.questionIndex,answer:body.answer})
                const completed=session.answers.length===4;if(completed){pending=false;revision++;session.completed_at='complete'}
                data={completed,answered:session.answers.length}
            }else{
                if(req.method()==='PUT'){
                    if(failSave){failSave=false;return route.fulfill({status:503,json:{success:false,error:{message:'기본 설정 저장 오류'}}})}
                    saveCount++;preferences={...req.postDataJSON(),surveyVersion:'survey'+saveCount};pending=true;session.answers=[];session.completed_at=null
                }
                data={preferences,onboarding:{surveyCompleted:true,routeChoicesCompleted:!!session.completed_at,usesCurrentSurvey:true}}
            }
            return route.fulfill({json:{success:true,data}})
        }
        if(url.hostname!=='127.0.0.1')return route.abort()
        return route.continue()
    })
    const visit=()=>page.goto('http://127.0.0.1:5189/__q4_test')
    await visit()
    await page.getByRole('button',{name:'선호 다시 불러오기'}).click()
    await page.getByTestId('q4-summary').waitFor();passed++
    assert.equal(await page.evaluate(()=>Boolean(document.querySelector('[data-testid="q4-summary"]').compareDocumentPosition(document.querySelector('form'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);passed++
    assert.equal(await page.getByRole('region',{name:'Q3 경로 비교'}).getByRole('button',{name:'경로 비교 다시 하기',exact:true}).count(),1);passed++
    await page.getByRole('button',{name:'좁은 도로·골목길',exact:true}).click()
    await page.getByRole('button',{name:'좁은 도로·골목길 순위 올리기',exact:true}).click()
    assert.match(await page.getByRole('list',{name:'선택한 부담 순위'}).locator('li').first().innerText(),/좁은 도로/);passed++
    await page.getByRole('button',{name:'좁은 도로·골목길 순위 내리기',exact:true}).click()
    await page.getByRole('button',{name:'좁은 도로·골목길 선택 해제',exact:true}).click()
    assert.equal(await page.getByRole('list',{name:'선택한 부담 순위'}).locator('li').count(),1);passed++
    await page.getByRole('button',{name:'경로 비교 다시 하기',exact:true}).click()
    await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(pending,false);passed++
    await page.getByRole('button',{name:'경로 비교 다시 하기',exact:true}).click()
    await page.getByRole('button',{name:'새 설문 시작',exact:true}).click()
    await page.getByText('경로 비교 설문 1 / 4',{exact:true}).waitFor();passed++
    assert.equal(await page.getByRole('region',{name:'Q3 경로 비교'}).getByTestId('q4-step').count(),1)
    assert.equal(await page.getByRole('button',{name:'거의 매일',exact:true}).isDisabled(),true)
    assert.equal(await page.getByTestId('q4-details').locator('tbody tr').count(),6)
    assert.equal(await page.getByTestId('q4-details').getAttribute('open'),null);passed+=4
    await page.getByRole('button',{name:'비교 잠시 닫기'}).click()
    await page.getByRole('button',{name:'경로 비교 이어서 하기',exact:true}).click()
    await page.getByText('경로 비교 설문 1 / 4',{exact:true}).waitFor();passed++
    assert.equal(await page.getByRole('button',{name:'다음 문항',exact:true}).isDisabled(),true);passed++
    await page.getByRole('button',{name:'판단하기 어려워요',exact:true}).click();failNext=true
    await page.getByRole('button',{name:'다음 문항',exact:true}).click();await page.getByRole('alert').filter({hasText:'일시적인 저장 오류'}).waitFor();passed++
    await page.getByRole('button',{name:'다음 문항',exact:true}).click();await page.getByText('경로 비교 설문 2 / 4',{exact:true}).waitFor()
    await visit();await page.getByRole('button',{name:'경로 비교 이어서 하기',exact:true}).click();await page.getByText('경로 비교 설문 2 / 4',{exact:true}).waitFor();passed++
    mkdirSync('.test-tools/q4-ui',{recursive:true});await page.screenshot({path:'.test-tools/q4-ui/survey-mobile.png',fullPage:true})
    for(let i=1;i<4;i++){await page.getByRole('button',{name:'판단하기 어려워요',exact:true}).click();await page.getByRole('button',{name:i===3?'변경사항 저장':'다음 문항',exact:true}).click()}
    await page.getByRole('heading',{name:'마이페이지',exact:true}).waitFor();await page.getByRole('status').filter({hasText:'변경사항이 저장되었습니다.'}).waitFor();passed+=2
    await page.getByRole('button',{name:'저장 알림 닫기'}).click();assert.equal(await page.getByRole('status').count(),0);passed++
    await visit();await page.getByRole('button',{name:'변경사항 저장',exact:true}).click();await page.getByRole('heading',{name:'마이페이지',exact:true}).waitFor();assert.equal(saveCount,0);passed++
    await visit();await page.getByRole('button',{name:'주 1회 이상',exact:true}).click();failSave=true
    await page.getByRole('button',{name:'좁은 도로·골목길',exact:true}).click()
    await page.getByRole('button',{name:'좁은 도로·골목길 순위 올리기',exact:true}).click()
    assert.equal(await page.getByTestId('q4-summary').count(),1)
    assert.equal(await page.getByRole('button',{name:'경로 비교 다시 하기',exact:true}).count(),0);passed+=2
    await page.getByRole('button',{name:'저장하고 경로 비교',exact:true}).click();await page.getByRole('alert').filter({hasText:'기본 설정 저장 오류'}).waitFor();assert.equal(saveCount,0);assert.equal(await page.getByRole('button',{name:'주 1회 이상',exact:true}).getAttribute('aria-pressed'),'true');passed++
    await page.getByRole('button',{name:'저장하고 경로 비교',exact:true}).click();await page.getByText('경로 비교 설문 1 / 4',{exact:true}).waitFor();assert.equal(saveCount,1);passed++
    assert.deepEqual(preferences.ranks,[2,0,1,0,0,0]);passed++
    for(let i=0;i<4;i++){await page.getByRole('button',{name:'판단하기 어려워요',exact:true}).click();await page.getByRole('button',{name:i===3?'변경사항 저장':'다음 문항',exact:true}).click()}
    await page.getByRole('heading',{name:'마이페이지',exact:true}).waitFor();passed++
    await visit();await page.getByRole('button',{name:'경로 비교 다시 하기',exact:true}).waitFor()
    assert.match(await page.getByRole('list',{name:'선택한 부담 순위'}).locator('li').first().innerText(),/좁은 도로/);passed++
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);passed++
    await page.screenshot({path:'.test-tools/q4-ui/settings-mobile.png',fullPage:true})
    await page.getByRole('list',{name:'선택한 부담 순위'}).locator('..').screenshot({path:'.test-tools/q4-ui/ranking-mobile.png'})
    await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'.test-tools/q4-ui/settings-desktop.png',fullPage:true})
    // Signup still finishes at its own completion screen, not MyPage.
    session.completed_at=null;session.answers=[]
    await page.goto('http://127.0.0.1:5189/__q4_test?entry=/onboarding')
    await page.getByText('경로 비교 설문 1 / 4',{exact:true}).waitFor()
    for(let i=0;i<4;i++){await page.getByRole('button',{name:'판단하기 어려워요',exact:true}).click();await page.getByRole('button',{name:i===3?'설정 완료':'다음 문항',exact:true}).click()}
    await page.getByRole('button',{name:'안전하길 시작하기'}).waitFor();passed++
    assert.deepEqual(errors,[]);passed++;console.log({passed,scope:'React + mocked API: Q3, retry, resume, no-op save, edited save, MyPage toast, signup, mobile/desktop'})
}finally{await browser?.close();await server.close()}
