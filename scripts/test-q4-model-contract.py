"""Compare JS Q4 export X8/probability with the unchanged Python production model."""
import json, sys, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'ml/src'))
from inference import ChoiceModel
model=ChoiceModel()
assert model.available
fixtures=json.loads((root/'.test-tools/q4-model-contract.json').read_text(encoding='utf8'))
for row in fixtures:
    actual=model.pair(row['a'],row['b'],row['weights'])
    assert all(math.isclose(a,b,abs_tol=1e-10) for a,b in zip(actual,row['x']))
    assert math.isclose(model.probability(actual),row['p'],abs_tol=1e-12)
print(json.dumps({'passed':len(fixtures)*2,'scope':'JS Q4 X8 and probability versus unchanged Python serving model'}))
