// 한 명령으로 SQLite worker → Express → 사용자/관리자 Vite를 실행한다. 종료 시 직접 시작한 프로세스만 정리한다.
import {spawn} from 'node:child_process'
import {readFileSync,existsSync} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import net from 'node:net'
import {parse} from 'dotenv'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const backend=path.join(root,'apps/backend'),envFile=path.join(backend,'.env')
if(!existsSync(envFile))throw new Error('apps/backend/.env가 필요합니다.')
const settings={...parse(readFileSync(envFile)),...process.env}
const arg=(name,fallback)=>Number(process.argv.find(v=>v.startsWith('--'+name+'='))?.split('=')[1]||fallback)
const apiPort=arg('api-port',settings.PORT||3000),workerPort=arg('worker-port',settings.ROUTING_WORKER_PORT||8100),mobilePort=arg('mobile-port',settings.MOBILE_PORT||5173),adminPort=arg('admin-port',settings.ADMIN_PORT||5174)
const children=[]
let stopping=false
function stop(code=0){
    if(stopping)return;stopping=true
    for(const child of children){if(child.exitCode!==null)continue;if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGTERM')}
    setTimeout(()=>process.exit(code),1500)
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop())
process.on('uncaughtException',error=>{console.error(error.message);stop(1)})
async function available(port){
    for(const host of ['127.0.0.1','::1'])await new Promise((resolve,reject)=>{
        const socket=net.connect({port,host});socket.setTimeout(1000)
        socket.once('connect',()=>{socket.destroy();reject(new Error('포트 '+port+'가 사용 중입니다. 기존 실행을 종료하거나 PORT 환경변수를 변경해주세요.'))})
        socket.once('error',()=>{socket.destroy();resolve()});socket.once('timeout',()=>{socket.destroy();resolve()})
    })
}
function start(label,command,args,cwd,env){
    const child=spawn(command,args,{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});children.push(child)
    for(const stream of [child.stdout,child.stderr])stream.on('data',data=>process.stdout.write('['+label+'] '+data.toString()))
    child.on('error',error=>{console.error(label+': '+error.message);stop(1)})
    child.on('exit',code=>{if(!stopping){console.error(label+' 종료: '+code);stop(code||1)}})
    return child
}
try{
    if(Number(process.versions.node.split('.')[0])<24)throw new Error('Node.js 24 이상이 필요합니다.')
    if(new Set([apiPort,workerPort,mobilePort,adminPort]).size!==4||[apiPort,workerPort,mobilePort,adminPort].some(p=>!Number.isInteger(p)||p<1||p>65535))throw new Error('서로 다른 유효한 포트 4개를 지정해주세요.')
    for(const port of [apiPort,workerPort,mobilePort,adminPort])await available(port)
    const token=settings.ROUTING_WORKER_TOKEN||randomBytes(24).toString('hex')
    const env={...settings,PORT:String(apiPort),ROUTING_WORKER_PORT:String(workerPort),ROUTING_WORKER_URL:'http://127.0.0.1:'+workerPort,ROUTING_WORKER_TOKEN:token,PYTHONUTF8:'1'}
    const python=process.platform==='win32'?path.join(root,'.venv/Scripts/python.exe'):path.join(root,'.venv/bin/python')
    if(!existsSync(python))throw new Error('Python 환경을 먼저 준비해주세요: scripts/setup-python.ps1')
    start('routing',python,['-X','utf8','apps/backend/routing/tools/serve.py'],root,env)
    const deadline=Date.now()+120000
    while(true){
        try{const r=await fetch(env.ROUTING_WORKER_URL+'/health',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(2000)});if(r.ok)break}catch{}
        if(Date.now()>deadline)throw new Error('계산기 시작 제한시간을 초과했습니다.')
        await new Promise(r=>setTimeout(r,500))
    }
    start('api',process.execPath,['--watch','src/server.js'],backend,env)
    const apiDeadline=Date.now()+30000
    while(true){
        try{const response=await fetch('http://127.0.0.1:'+apiPort+'/api/health',{signal:AbortSignal.timeout(2000)});if(response.ok)break}catch{}
        if(Date.now()>apiDeadline)throw new Error('API가 준비되지 않았습니다. backend/.env와 위 오류를 확인해주세요.')
        await new Promise(resolve=>setTimeout(resolve,300))
    }
    const vite=path.join(root,'node_modules/vite/bin/vite.js')
    const frontendEnv={...process.env,VITE_API_BASE_URL:'http://localhost:'+apiPort+'/api'}
    const mobileEnv={...frontendEnv,VITE_API_BASE_URL:'/api',LOCAL_API_TARGET:'http://127.0.0.1:'+apiPort}
    if(Boolean(process.env.MOBILE_HTTPS_CERT)!==Boolean(process.env.MOBILE_HTTPS_KEY))throw new Error('MOBILE_HTTPS_CERT와 MOBILE_HTTPS_KEY를 함께 지정해주세요.')
    start('mobile',process.execPath,[vite,'--host',process.env.MOBILE_HOST||'127.0.0.1','--port',String(mobilePort),'--strictPort'],path.join(root,'apps/frontend_mobile'),mobileEnv)
    start('admin',process.execPath,[vite,'--host','127.0.0.1','--port',String(adminPort),'--strictPort'],path.join(root,'apps/frontend_admin'),frontendEnv)
    console.log('\n안전하길: '+(process.env.MOBILE_HTTPS_CERT?'https':'http')+'://localhost:'+mobilePort+' | 관리자: http://localhost:'+adminPort+'\n종료: Ctrl+C')
}catch(error){console.error(error.message);stop(1)}
