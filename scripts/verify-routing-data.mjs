// 기능: 선별 반입 파일 SHA256과 SQLite quick_check를 읽기 전용으로 검사한다. Node 24 기준이며 DB 적재/활성화를 수행하지 않는다.
import { readFileSync, createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const root = fileURLToPath(new URL('../apps/backend/routing/', import.meta.url))
const manifest = JSON.parse(readFileSync(resolve(root, 'service_manifest.json'), 'utf8'))
const results = []
for (const [name, expected] of Object.entries(manifest.files)) {
    const path = resolve(root, name)
    if (!path.startsWith(resolve(root) + sep)) throw new Error(`Invalid path: ${name}`)
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk)
    if (hash.digest('hex') !== expected) throw new Error(`Hash mismatch: ${name}`)
    if (/\.(sqlite|gpkg)$/.test(name)) {
        const db = new DatabaseSync(path, { readOnly: true })
        try {
            const check = db.prepare('PRAGMA quick_check').all()
            if (check.length !== 1 || check[0].quick_check !== 'ok') throw new Error(`SQLite integrity: ${name}`)
            results.push({ file: name, quick_check: 'ok' })
        } finally { db.close() }
    }
}
console.log(JSON.stringify({ releaseId: manifest.release_id, hashesVerified: Object.keys(manifest.files).length, databases: results }, null, 2))
