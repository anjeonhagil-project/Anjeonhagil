// 동결된 데이터 manifest는 보존하고 수정된 실행 코드의 무결성 목록을 별도로 생성한다.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
const root = path.resolve('apps/backend/routing')
async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === '__pycache__') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(p))
    else if (e.name.endsWith('.py')) out.push(p)
  }
  return out
}
const files = {}
for (const file of (await walk(path.join(root, 'tools'))).sort()) {
  files[path.relative(root, file).replaceAll('\\', '/')] = createHash('sha256').update(await readFile(file)).digest('hex')
}
await writeFile(path.join(root, 'runtime_manifest.json'), JSON.stringify({ service_contract: 'service_20260916', files }, null, 2) + '\n')
console.log(`Runtime manifest: ${Object.keys(files).length} Python files`)
