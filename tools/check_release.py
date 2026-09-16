"""Validate either the full release or the isolated dataset, then rerun current gates."""
from pathlib import Path
import hashlib,json,subprocess,sys,argparse,tempfile
DATA=Path(__file__).resolve().parents[1]
full=DATA.parent/'release_manifest.json'
ROOT=DATA.parent if full.is_file() and DATA.name=='dataset' else DATA
manifest=full if ROOT!=DATA else DATA/'package_manifest.json'
a=argparse.ArgumentParser();a.add_argument('--hash-only',action='store_true');args=a.parse_args()
m=json.loads(manifest.read_text())
for name,h in m['files'].items():
 p=(ROOT/name).resolve()
 if not p.is_relative_to(ROOT.resolve()) or not p.is_file():raise SystemExit('Missing release file: '+name)
 with p.open('rb') as f:actual=hashlib.file_digest(f,'sha256').hexdigest()
 if actual!=h:raise SystemExit('Release file differs: '+name)
release=json.loads((DATA/'final_release.json').read_text())
report={'release_id':release['release_id'],'scope':'full_release' if ROOT!=DATA else 'dataset_only','files_verified':len(m['files']),'all_hashes_match':True}
if not args.hash_only:
 p=subprocess.run([sys.executable,'-B',str(DATA/'tools/check.py')],capture_output=True,text=True,check=True)
 report['legacy_static_regression']=json.loads(p.stdout)
 # Run current tests; do not treat saved all_passed fields as a fresh calculation.
 with tempfile.TemporaryDirectory(prefix='anjeon-verify-') as tmp:
  for tool,key in [('validate_child100.py','current_child_geometry'),('validate_hourly.py','current_hourly_and_contract')]:
   output=Path(tmp)/(key+'.json');print('Running '+tool,file=sys.stderr,flush=True)
   subprocess.run([sys.executable,'-B',str(DATA/'tools'/tool),'--report',str(output)],stdout=subprocess.DEVNULL,check=True)
   value=json.loads(output.read_text());assert value['all_passed']
   report[key]={k:v for k,v in value.items() if k!='fixed_paths'}
print(json.dumps(report,ensure_ascii=False,indent=2))
