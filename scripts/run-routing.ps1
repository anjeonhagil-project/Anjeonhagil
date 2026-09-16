# 기능(Anjeonhagil): 준비한 .venv에서 동결 계산기를 UTF-8 모드로 실행한다. 토큰/호스트/포트는 실행 환경변수로 전달한다.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) { throw 'Run scripts/setup-python.ps1 first.' }
& $venvPython -X utf8 (Join-Path $projectRoot 'apps\backend\routing\tools\serve.py')
exit $LASTEXITCODE
