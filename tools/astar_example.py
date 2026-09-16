"""OD10 static distance example, not the complete personalized Q3 service."""
from pathlib import Path
import json,sys,math
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/runtime'))
import search_engine as se
from interface import TeamCalculator,VERSIONS
segments=json.loads((ROOT/'tools/examples/route_request.json').read_text())['segments']
s=se.arcs[segments[0]['arc_id']][0];t=se.arcs[segments[-1]['arc_id']][1]
cost,path,states=se.search(s,t,'distance',True)
dcost,dpath,dstates=se.search(s,t,'distance',False)
assert math.isclose(cost,dcost,rel_tol=1e-12,abs_tol=1e-7)
result=TeamCalculator().evaluate({**VERSIONS,'segments':[{'arc_id':a} for a in path]})
print(json.dumps({'scope':'STATIC_REFERENCE_DISTANCE_NOT_FULL_Q3_SERVICE','source_node':s,'target_node':t,'astar_dijkstra_cost_equal':True,'astar_states':states,'dijkstra_states':dstates,'arc_ids':path,'result':result},ensure_ascii=False,indent=2))
