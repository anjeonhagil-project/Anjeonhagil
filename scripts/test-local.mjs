// Run all deterministic local checks; HTTP/Supabase/browser tests are separate commands.
import {spawnSync} from 'node:child_process'
import {mkdirSync} from 'node:fs'
import path from 'node:path'
const python=path.resolve(process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python')
mkdirSync('.test-tools',{recursive:true})
const checks=[
    [process.execPath,['scripts/verify-routing-data.mjs']],
    [process.execPath,['scripts/test-service-contract.mjs']],
    [process.execPath,['scripts/test-route-comparison.mjs']],
    [process.execPath,['scripts/test-admin-usage.mjs']],
    ...['test-service-routing.py','test-q4-data.py','test-algorithms.py','test-models.py','test-personalization.py','test-learning-data.py'].map(p=>[python,['-X','utf8','scripts/'+p]]),
    [process.execPath,['scripts/test-service-db.mjs']],
]
for(const [command,args] of checks){
    console.log('\nVERIFY '+args.at(-1))
    const result=spawnSync(command,args,{stdio:'inherit',windowsHide:true,env:{...process.env,PYTHONUTF8:'1'}})
    if(result.error||result.status!==0){console.error('Verification failed');process.exit(result.status||1)}
}
console.log('PASS: all local service checks')
