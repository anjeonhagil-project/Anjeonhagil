// Disposable local worker/API stack for the existing full HTTP/Supabase regression suite.
import {spawn} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {parse} from 'dotenv'
import {randomBytes} from 'node:crypto'
import net from 'node:net'
Object.assign(process.env,parse(readFileSync('apps/backend/.env')))
const free=net.createServer();free.listen(0,'127.0.0.1');await new Promise(r=>free.on('listening',r));const port=free.address().port;await new Promise(r=>free.close(r))
Object.assign(process.env,{ROUTING_WORKER_PORT:String(port),ROUTING_WORKER_URL:`http://127.0.0.1:${port}`,ROUTING_WORKER_TOKEN:randomBytes(24).toString('hex'),PYTHONUTF8:'1'})
const worker=spawn(process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python',['-X','utf8','apps/backend/routing/tools/serve.py'],{env:process.env,stdio:['ignore','ignore','pipe'],windowsHide:true})
let server,startError
worker.on('error',e=>{startError=e});worker.stderr.on('data',()=>{})
try{
    const deadline=Date.now()+120000
    while(true){
        if(startError||worker.exitCode!==null)throw Error('WORKER_START_FAILED')
        try{const r=await fetch(process.env.ROUTING_WORKER_URL+'/health',{headers:{Authorization:'Bearer '+process.env.ROUTING_WORKER_TOKEN},signal:AbortSignal.timeout(1000)});if(r.ok)break}catch{}
        if(Date.now()>deadline)throw Error('WORKER_START_TIMEOUT')
        await new Promise(r=>setTimeout(r,500))
    }
    const {default:app}=await import('../apps/backend/src/app.js');server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r))
    const child=spawn(process.execPath,['scripts/test-service-api.mjs',`--api-url=http://127.0.0.1:${server.address().port}/api`],{env:process.env,stdio:'inherit',windowsHide:true})
    const code=await new Promise((r,j)=>{child.on('exit',r);child.on('error',j)});if(code!==0)throw Error('SERVICE_API_REGRESSION_FAILED')
}finally{
    if(server)await new Promise(r=>server.close(r))
    if(worker.pid&&worker.exitCode===null){
        if(process.platform==='win32')await new Promise(r=>spawn('taskkill',['/PID',String(worker.pid),'/T','/F'],{stdio:'ignore',windowsHide:true}).on('exit',r))
        else worker.kill()
    }
}
