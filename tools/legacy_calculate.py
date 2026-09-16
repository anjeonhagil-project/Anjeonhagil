"""Read-only package entrypoint. Python 3.12+, standard library only."""
from pathlib import Path
import argparse,json,sys
ROOT=Path(__file__).resolve().parent.parent
sys.dont_write_bytecode=True
sys.path.insert(0,str(ROOT/'tools/runtime'))
from interface import TeamCalculator
ap=argparse.ArgumentParser(description='Calculate route features from ordered directed arc segments.')
ap.add_argument('request',nargs='?',type=Path,default=ROOT/'tools/examples/route_request.json')
args=ap.parse_args()
value=TeamCalculator().evaluate(json.loads(args.request.read_text(encoding='utf-8')))
print(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False))
