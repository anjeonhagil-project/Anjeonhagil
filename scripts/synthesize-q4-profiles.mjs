import {readFile} from 'node:fs/promises'
import {synthesizeProfiles} from '../ml/q4-synthetic-profiles.mjs'
import {hash,POLICY,VERSION} from '../ml/q4-trial.mjs'

let source=''
for await(const chunk of process.stdin)source+=chunk
const payload=JSON.parse(source)
const bank=JSON.parse(await readFile(new URL('../apps/backend/src/config/q4Cases.json',import.meta.url),'utf8'))
const model=JSON.parse(await readFile(new URL('../ml/bundled/logistic.json',import.meta.url),'utf8'))
const profiles=synthesizeProfiles(payload.records,bank,model)

process.stdout.write(JSON.stringify({
    profiles,
    metadata:{
        caseSetVersion:bank.case_set_version,
        estimatorVersion:VERSION,
        policy:POLICY,
        modelVersion:model.model_version,
        modelHash:hash(model)
    }
}))
