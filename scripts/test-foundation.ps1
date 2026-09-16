# 기능(Anjeonhagil): HTTP 계산→로컬 SQL→학습 X8 검증을 재현한다. 원격 Supabase나 실제 사용자 데이터는 사용하지 않는다.
# 전제: scripts/setup-python.ps1 실행. PGlite가 없으면 .test-tools에만 고정 버전을 설치한다.
param([string]$PGlitePath = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) { throw 'Run scripts/setup-python.ps1 first.' }
Push-Location $projectRoot
try {
    if (-not $PGlitePath) {
        $databaseTools = Join-Path $projectRoot '.test-tools\db-test'
        $PGlitePath = Join-Path $databaseTools 'node_modules\@electric-sql\pglite\dist\index.js'
        if (-not (Test-Path -LiteralPath $PGlitePath)) {
            & npm.cmd install --prefix $databaseTools --no-package-lock --ignore-scripts --no-audit --no-fund '@electric-sql/pglite@0.5.8'
            if ($LASTEXITCODE -ne 0) { throw 'PGlite installation failed.' }
        }
    }
    & node scripts/verify-routing-data.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Dataset verification failed.' }
    & $venvPython -X utf8 scripts/test-routing-foundation.py
    if ($LASTEXITCODE -ne 0) { throw 'Routing verification failed.' }
    & node scripts/test-migration.mjs $PGlitePath .test-tools/routing-http-fixture.json
    if ($LASTEXITCODE -ne 0) { throw 'SQL verification failed.' }
    & $venvPython -X utf8 scripts/test-learning-contract.py
    if ($LASTEXITCODE -ne 0) { throw 'Learning contract verification failed.' }
} finally { Pop-Location }
