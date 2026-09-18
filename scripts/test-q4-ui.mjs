// Actual React page in Chromium with deterministic API fixtures; no hosted DB writes.
import {createServer} from 'vite'
import react from '@vitejs/plugin-react'
import {chromium} from 'playwright'
import {readFileSync,mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module">import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import Preferences from '/src/features/my/DrivingPreferencesPage.jsx';import Onboarding from '/src/features/onboarding/OnboardingPage.jsx';import '/src/styles/global.css';const app=React.createElement(MemoryRouter,{initialEntries:['/my/driving-preferences']},React.createElement(Routes,null,React.createElement(Route,{path:'/my/driving-preferences',element:React.createElement(Preferences)}),React.createElement(Route,{path:'/onboarding',element:React.createElement(Onboarding)})));createRoot(document.getElementById('root')).render(app);</script></html>`
const server=await createServer({root:'apps/frontend_mobile',configFile:false,plugins:[react(),{name:'q4-test-page',configureServer(s){s.middlewares.use('/__q4_test',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__q4_test',html))})}}],server:{host:'127.0.0.1',port:5189,strictPort:true}})
let browser,passed=0
try{
    await server.listen();browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    const bank=JSON.parse(readFileSync('apps/backend/src/config/q4Cases.json','utf8'))
    const session={session_id:'12345678-1234-1234-1234-123456789012',questions:bank.cases.COMPLEX_INTERSECTION.map(q=>({...q,routes:q.routes.map((r,i)=>({...r,label:i?'B':'A'}))})),reference_factor:'COMPLEX_INTERSECTION',reference_source:'Q2_TOP',answers:[],completed_at:null,q4AffectsRecommendation:false}
    let revision=1,pending=false,failNext=false
    const profile=()=>({enabled:true,effectiveWeights:[1,0,0,0,0,0],alpha:0,notice:'실제 선택 기반 보정',q4:{status:'COMPLETE',enabled:true,axes:{},applicable:false,pending,revision,training:{status:'TRIAL_ONLY'}}})
    await page.route('**/*',async route=>{
        const req=route.request(),url=new URL(req.url()),path=url.pathname
        if(path.includes('/driving-preferences')){
            let data
            if(path.endsWith('/personalization'))data=profile()
            else if(path.endsWith('/q4/restart')){pending=true;session.answers=[];session.completed_at=null;data={surveyVersion:'survey'}}
            else if(path.endsWith('/q4')&&req.method()==='GET')data=session
            else if(path.endsWith('/q4')){
                if(failNext){failNext=false;return route.fulfill({status:503,json:{success:false,error:{message:'일시적인 저장 오류'}}})}
                const body=req.postDataJSON();assert.equal(body.questionIndex,session.answers.length);session.answers.push({question_index:body.questionIndex,answer:body.answer})
                const completed=session.answers.length===4;if(completed){pending=false;revision++;session.completed_at='2026-09-17T00:00:00Z'}
                data={completed,answered:session.answers.length}
            }else data={preferences:{surveyVersion:'survey',drivingFrequency:'daily',ranks:[1,0,0,0,0,0]},onboarding:{surveyCompleted:true,routeChoicesCompleted:true}}
            return route.fulfill({json:{success:true,data}})
        }
        if(url.hostname!=='127.0.0.1')return route.abort()
        return route.continue()
    })
    await page.goto('http://127.0.0.1:5189/__q4_test')
    await page.getByRole('button',{name:'시간·거리 선호 다시 설정',exact:true}).click()
    await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(pending,false);passed++
    await page.getByRole('button',{name:'시간·거리 선호 다시 설정',exact:true}).click()
    await page.getByRole('button',{name:'새 설문 시작',exact:true}).click()
    await page.getByText('경로 비교 설문 1 / 4',{exact:true}).waitFor();passed++
    assert.equal(await page.getByRole('button',{name:'다음 문항',exact:true}).isDisabled(),true);passed++
    await page.getByRole('button',{name:'판단하기 어려워요',exact:true}).click();failNext=true
    await page.getByRole('button',{name:'다음 문항',exact:true}).click();await page.getByRole('alert').filter({hasText:'일시적인 저장 오류'}).waitFor();passed++
    await page.getByRole('button',{name:'다음 문항',exact:true}).click();await page.getByText('경로 비교 설문 2 / 4',{exact:true}).waitFor()
    await page.goto('http://127.0.0.1:5189/__q4_test')
    await page.getByRole('button',{name:'시간·거리 설문 이어서 하기',exact:true}).click();await page.getByText('경로 비교 설문 2 / 4',{exact:true}).waitFor();passed++
    mkdirSync('.test-tools/q4-ui',{recursive:true});await page.screenshot({path:'.test-tools/q4-ui/survey-mobile.png',fullPage:true})
    for(let i=1;i<4;i++){await page.getByRole('button',{name:'판단하기 어려워요',exact:true}).click();await page.getByRole('button',{name:i===3?'설정 완료':'다음 문항',exact:true}).click()}
    await page.goto('http://127.0.0.1:5189/__q4_test')
    await page.getByRole('button',{name:'시간·거리 선호 다시 설정',exact:true}).waitFor();assert.equal(revision,2);passed++
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);passed++
    await page.evaluate(()=>document.querySelectorAll('*').forEach(el=>{if(el.scrollTop)el.scrollTop=0}))
    await page.screenshot({path:'.test-tools/q4-ui/settings-mobile.png',fullPage:true})
    await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'.test-tools/q4-ui/settings-desktop.png',fullPage:true})
    assert.deepEqual(errors,[]);passed++;console.log({passed,scope:'Real React page, mocked API, Chromium mobile/desktop; cancel, error retry, resume, completion, overflow'})
}finally{await browser?.close();await server.close()}
