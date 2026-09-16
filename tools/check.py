"""Verify delivered bytes and preserved contract behavior, without rebuilding data."""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parent.parent
sys.dont_write_bytecode=True
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def verify():
    records=json.loads((ROOT/'package_manifest.json').read_text(encoding='utf-8'))['files']
    failures=[]
    for name,expected in records.items():
        p=(ROOT/name).resolve()
        if not p.is_relative_to(ROOT) or not p.is_file() or sha(p)!=expected:failures.append(name)
    if failures:raise RuntimeError('PACKAGE_FILE_MISMATCH: '+', '.join(failures))
    return len(records)
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--hash-only',action='store_true');a=ap.parse_args()
    count=verify();result={'package_files_verified':count,'all_hashes_match':True}
    if not a.hash_only:
        proc=subprocess.run([sys.executable,'-B',str(ROOT/'tools/runtime/contract_checks.py')],text=True,encoding='utf-8',capture_output=True,check=True)
        detail=json.loads(proc.stdout)
        result.update(invalid_inputs_rejected=detail['invalid_cases_rejected'],preserved_paths=detail['prior_release_fixed_paths_numerically_unchanged'],x8_antisymmetry=detail['A_B_antisymmetry'],partial_circle_direction_invariance=detail['partial_circle_direction_invariance'])
        sample=subprocess.run([sys.executable,'-B',str(ROOT/'tools/legacy_calculate.py')],text=True,encoding='utf-8',capture_output=True,check=True)
        expected=json.loads((ROOT/'tools/examples/route_expected.json').read_text(encoding='utf-8'))
        if json.loads(sample.stdout)!=expected:raise RuntimeError('EXAMPLE_RESPONSE_MISMATCH')
        result['legacy_example_response_matches_saved_fixture']=True
    print(json.dumps(result,ensure_ascii=False,indent=2))
