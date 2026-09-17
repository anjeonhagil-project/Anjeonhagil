"""팀 회귀 테스트를 같은 그래프에서 실행해 brute-force/top-K/회전 이력 재개를 확인한다."""
from pathlib import Path
import sys,importlib,json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/backend/routing/tests'))
names=['yen_exhaustive','yen_goal_entry','restriction_search_resume','restriction_search_boundaries']
for name in names:
    print('RUN',name,flush=True)
    importlib.import_module(name).main()
(ROOT/'.test-tools/algorithm-report.json').write_text(json.dumps({'passed_suites':names,'scope':'restriction expanded states and Yen top K'},indent=2),encoding='utf8')
