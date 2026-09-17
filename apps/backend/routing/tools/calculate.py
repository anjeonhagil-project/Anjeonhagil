"""Current hourly route evaluation. Default input is the bundled OD10 hourly example."""
from pathlib import Path
import json,argparse
from api import TeamCalculator
p=Path(__file__).resolve().parent
a=argparse.ArgumentParser();a.add_argument('--input',type=Path,default=p/'examples/hourly_request.json');args=a.parse_args()
print(json.dumps(TeamCalculator().evaluate(json.loads(args.input.read_text())),ensure_ascii=False,indent=2))
