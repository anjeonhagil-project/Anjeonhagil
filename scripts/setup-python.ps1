# 기능(Anjeonhagil): Python 3.12로 .venv와 계산/DB 의존성을 준비한다. 기존 venv와 전역 패키지는 변경하지 않는다.
param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) {
    & $Python -X utf8 -c "import sys; assert sys.version_info[:2] == (3, 12), 'Python 3.12 required'"
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 is required.' }
    & $Python -X utf8 -m venv (Join-Path $projectRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed.' }
}
& $venvPython -X utf8 -c "import sys; assert sys.version_info[:2] == (3, 12), 'Existing .venv must use Python 3.12'"
if ($LASTEXITCODE -ne 0) { throw 'Existing .venv requires manual inspection; it was not removed.' }
& $venvPython -X utf8 -m pip install -r (Join-Path $projectRoot 'apps\backend\routing\requirements.txt') -r (Join-Path $projectRoot 'database\requirements.txt') -r (Join-Path $projectRoot 'ml\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
& $venvPython -X utf8 -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Dependency verification failed.' }
