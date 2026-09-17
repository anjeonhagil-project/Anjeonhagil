"""Small CLI for the same candidate ranking used by the local routing worker."""
import argparse,json
from pathlib import Path
from inference import ChoiceModel
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('input',type=Path);args=parser.parse_args()
    payload=json.loads(args.input.read_text(encoding='utf8'))
    print(json.dumps(ChoiceModel().rank(payload['candidates'],payload['weights'],comparison=True),ensure_ascii=False))
