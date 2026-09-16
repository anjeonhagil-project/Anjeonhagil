# Verify the current service contract locally. Real Supabase/browser checks are separate opt-in commands.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) { throw 'Run scripts/setup-python.ps1 first.' }
Push-Location $projectRoot
try {
    & node scripts/verify-routing-data.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Data verification failed.' }
    & node scripts/test-service-contract.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Contract verification failed.' }
    foreach ($testFile in @('test-service-routing.py','test-q4-data.py','test-algorithms.py','test-models.py','test-personalization.py','test-learning-data.py')) {
        & $venvPython -X utf8 (Join-Path 'scripts' $testFile)
        if ($LASTEXITCODE -ne 0) { throw ('Verification failed: ' + $testFile) }
    }
    & node scripts/test-service-db.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Database verification failed.' }
} finally { Pop-Location }
