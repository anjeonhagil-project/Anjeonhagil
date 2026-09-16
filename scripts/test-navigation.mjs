// Deterministic GPS traces cover crossings, bad fixes, stale data and arrival hysteresis.
import assert from 'node:assert/strict'
import {buildTrack,pointAt,distance,advanceGps,projectPosition,validFix} from '../apps/frontend_mobile/src/features/navigation/navigationMath.js'
import {validateSearchInput} from '../apps/backend/src/modules/routes/routes.validation.js'
let passed=0
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const track=buildTrack({coordinates:[[127,37],[127,37.002],[127.002,37.002]]},[{coordinate_index:1,kind:'right'},{coordinate_index:2,kind:'arrival'}])
const t=Date.now(),fix=(m,extra={})=>({...pointAt(track,m),accuracy:5,timestamp:t,speed:4,...extra})
check('geometry and turn offsets',()=>{assert.ok(track.total>390&&track.total<410);assert.ok(track.steps[0].at>220);assert.equal(track.steps[1].at,track.total)})
check('clamped interpolation',()=>{assert.equal(pointAt(track,-10).lng,127);assert.equal(pointAt(track,9999).lng,127.002)})
check('invalid geometry rejected',()=>{assert.throws(()=>buildTrack({coordinates:[[127,37],[NaN,37]]}));assert.throws(()=>buildTrack({coordinates:[[127,37],[127,37]]}))})
check('location projection',()=>{const p=projectPosition(track,fix(80));assert.ok(Math.abs(p.progress-80)<.01);assert.ok(p.offset<.01)})
check('opposite heading requires rerouting without advancing',()=>{let s={};for(let i=0;i<3;i++)s=advanceGps(track,fix(80,{heading:180,timestamp:t+i*1000}),s,t+i*1000);assert.equal(s.status,'offroute');assert.equal(s.match,undefined)})
check('reroute heading validation',()=>{const input={searchId:'12345678-1234-4234-8234-123456789abc',origin:{lng:127,lat:37,heading:90},destination:{lng:127.01,lat:37},departureAt:'2026-09-17T00:00:00Z'};assert.equal(validateSearchInput(input).origin.heading,90);for(const heading of [360,-1,NaN,'90'])assert.throws(()=>validateSearchInput({...input,origin:{...input.origin,heading}}))})
check('accuracy and stale gates',()=>{assert.ok(validFix(fix(10),t));for(const patch of [{accuracy:90},{accuracy:-1},{timestamp:t-13000},{lat:NaN},{lng:190},{timestamp:t+5000}])assert.equal(validFix(fix(10,patch),t),false)})
check('poor accuracy cannot advance or complete',()=>{const a=advanceGps(track,fix(30),{},t);const b=advanceGps(track,fix(track.total,{accuracy:80}),a,t);assert.equal(b.match.progress,a.match.progress);assert.equal(b.status,'weak');assert.equal(validFix(b.fix,t),false)})
check('three accurate deviations required',()=>{let s={};for(let i=0;i<3;i++){s=advanceGps(track,fix(40,{lng:127.01,timestamp:t+i*1000}),s,t+i*1000);assert.equal(s.status,i===2?'offroute':'checking')}})
check('same callback timestamp cannot trigger arrival',()=>{let s={};for(let i=0;i<5;i++)s=advanceGps(track,fix(track.total),s,t);assert.equal(s.arrivalCount,1)})
check('arrival requires repeated endpoint fixes',()=>{let s={};for(let i=0;i<3;i++)s=advanceGps(track,fix(track.total,{timestamp:t+i*1000}),s,t+i*1000);assert.equal(s.status,'arrived')})
check('GPS jump does not advance',()=>{let s=advanceGps(track,fix(5),{},t);s=advanceGps(track,fix(track.total,{timestamp:t+1000}),s,t+1000);assert.equal(s.status,'checking');assert.ok(s.match.progress<10)})
check('crossing retains route continuity',()=>{const loop=buildTrack({coordinates:[[127,37],[127.001,37],[127.001,37.001],[127,37.001],[127,37],[127,36.999]]});const p=projectPosition(loop,{lng:127,lat:37,timestamp:t+1000}, {progress:5,timestamp:t});assert.ok(p.progress<20)})
console.log(JSON.stringify({passed}))
