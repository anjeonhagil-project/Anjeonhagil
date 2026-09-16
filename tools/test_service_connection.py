"""Run live local worker -> shipped Node service -> isolated PostgreSQL, without Supabase credentials."""
from pathlib import Path
import subprocess,sys,os,json
root=Path(__file__).resolve().parents[2]
if not (root/'service/tests/final/integration.mjs').is_file():raise SystemExit('This optional service integration test requires the full FINAL_CHILD100 ZIP. Dataset validation uses tools/check_release.py; A*/ML do not need the service source.')
env=os.environ.copy();env['LIVE_WORKER']='1'
p=subprocess.Popen([sys.executable,str(root/'dataset/tools/serve.py')],env=env,stdout=subprocess.PIPE,text=True)
try:
 line=p.stdout.readline();print(line,flush=True)
 if not json.loads(line)['ready']:raise RuntimeError('worker did not start')
 subprocess.run(['node',str(root/'service/tests/final/integration.mjs')],env=env,check=True)
finally:p.terminate();p.wait(timeout=10)
