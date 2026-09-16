from pathlib import Path
import json
from features import FeatureCalculator
B=Path(__file__).resolve().parent.parent
c=FeatureCalculator(B/'data/features.sqlite',B/'data/transitions.sqlite',B/'data/graph.sqlite')
route=json.loads((B/'examples/prior_route_paths.json').read_text())[0]
print(json.dumps(c.calculate([{'arc_id':a} for a in route['arc_ids']]),ensure_ascii=False,indent=2))
