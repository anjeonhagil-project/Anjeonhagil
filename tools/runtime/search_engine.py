from pathlib import Path
import sys,json,sqlite3,collections,heapq,math,time,hashlib
P=Path(__file__).resolve().parent;R=P.parent.parent;B=R
from runtime import Calculator
from interface import REVIEW_TURNS,TeamCalculator
calc=TeamCalculator().engine;conn=sqlite3.connect('file:'+str(R/'data/feature_policy.sqlite')+'?mode=ro',uri=True)
conn.execute('attach database ? as rt',(str(B/'data/routing.sqlite'),))
conn.execute('attach database ? as tr',(str(B/'data/transitions.sqlite'),))
# Common comparison graph: static eligible and all required attributes present.
arcs={};outs=collections.defaultdict(list)
for aid,s,t,L,n,m,ch,eta in conn.execute('select a.arc_id,r.from_node,r.to_node,r.length_m,e.narrow_score,a.merge_score,e.child_nearby,a.eta_dev_seconds from arc_policy a join rt.arcs r using(arc_id) join edge_policy e using(edge_id) where a.eligible=1 and e.eligible=1 and e.narrow_score is not null and a.merge_score is not null and a.eta_dev_seconds>0'):
 arcs[aid]=(s,t,L,n,m,ch,eta);outs[s].append(aid)
for v in outs.values():v.sort()
xy={n:(x,y) for n,x,y in conn.execute('select * from rt.nodes')};trans=collections.defaultdict(list)
for a,b,complexp,turnp in conn.execute('select from_arc,to_arc,complex_proxy,unfamiliar_proxy from tr.transition_proxy'):
 if a in arcs and b in arcs and (a,b) not in REVIEW_TURNS:trans[a].append((b,complexp,turnp))
for v in trans.values():v.sort()
class Rules:
 def __init__(self,rows):
  self.no=set();self.only=collections.defaultdict(lambda:collections.defaultdict(set));self.prefix=set()
  for rid,k,path in rows:
   self.prefix.update(path[:j] for j in range(1,len(path)))
   if k=='no':self.no.add(path)
   else:
    for j in range(1,len(path)):self.only[path[:j]][rid].add(path[j])
 def advance(self,state,a):
  for pre in state:
   if pre+(a,) in self.no:return None
   if any(a not in choices for choices in self.only.get(pre,{}).values()):return None
  return tuple(sorted({p+(a,) for p in state if p+(a,) in self.prefix}|({(a,)} if (a,) in self.prefix else set())))
rules=Rules([(rid,k,tuple(json.loads(v))) for rid,k,v in conn.execute('select * from rt.restriction_sequences')])
profiles={'distance':(0,0,0,0,0),'time':None,'narrow_avoid':(3,0,0,0,0),'balanced_probe':(1,.5,.5,100,50)}
# Euclidean multiplier bounded using actual graph chord lengths; nonnegative turn penalties.
base={}
for name,w in profiles.items():
 base[name]={a:v[6] if w is None else v[2]*(1+w[0]*v[3]+w[1]*v[4]+w[2]*v[5]) for a,v in arcs.items()}
mins={k:min(cost[a]/math.dist(xy[arcs[a][0]],xy[arcs[a][1]]) for a in arcs if math.dist(xy[arcs[a][0]],xy[arcs[a][1]])>0) for k,cost in base.items()}

# 수정.
def search(
    s,
    t,
    name,
    use_h=True,
    start_arcs=None,
    end_arcs=None,
    *,
    initial_state=None,
    blocked_states=None,
    blocked_moves=None,
    return_state_path=False,
    heuristic_distances=None,
    deadline=None,
):
    if (
        type(s) != int
        or type(t) != int
        or s not in xy
        or t not in xy
    ):
        raise ValueError("known integer nodes required")

    if name not in profiles:
        raise ValueError("unsupported objective")

    for allowed, node, side in (
        (start_arcs, s, 0),
        (end_arcs, t, 1),
    ):
        if allowed is not None and (
            not isinstance(allowed, (list, tuple, set, frozenset))
            or not allowed
            or any(
                type(a) != int
                or a not in arcs
                or arcs[a][side] != node
                for a in allowed
            )
        ):
            raise ValueError("invalid endpoint arc constraints")

    # 처음 출발하면 이전 Arc와 제한 이력이 없다.
    # 중간 재개라면 앞부분에서 계산한 상태를 그대로 받는다.
    if initial_state is None:
        start_state = (s, -1, ())
    else:
        start_state = initial_state

        if not isinstance(start_state, tuple) or len(start_state) != 3:
            raise ValueError("invalid initial state")

        node, previous_arc, history = start_state

        if node != s or not isinstance(history, tuple):
            raise ValueError("invalid initial state")

        if previous_arc == -1:
            if history:
                raise ValueError("history requires a previous arc")
        elif previous_arc not in arcs or arcs[previous_arc][1] != s:
            raise ValueError("previous arc must end at the start node")

        # history는 임의로 만들지 않고, 기존 탐색 결과에서 전달한다.
        if any(
            not isinstance(prefix, tuple)
            or prefix not in rules.prefix
            for prefix in history
        ):
            raise ValueError("invalid restriction history")

    blocked_states = frozenset(
        () if blocked_states is None else blocked_states
    )
    blocked_moves = frozenset(
        () if blocked_moves is None else blocked_moves
    )

    if start_state in blocked_states:
        raise RuntimeError("no_route_in_supported_graph")

    if (
    deadline is not None
    and time.monotonic() >= deadline
    ):
        raise RuntimeError("yen_time_limit")

    if (
        use_h
        and heuristic_distances is not None
        and start_state[0] not in heuristic_distances
    ):
        raise RuntimeError("no_route_in_supported_graph")
    
    costs = base[name]
    weights = profiles[name]

    # 동점일 때 상태 tuple끼리 비교하지 않도록 순번을 넣는다.
    serial = 0
    queue = [(0.0, serial, 0.0, start_state)]

    best = {start_state: 0.0}
    parent = {}
    expanded_states = 0

    while queue:
        _, _, current_cost, state = heapq.heappop(queue)

        if current_cost != best.get(state):
            continue

        expanded_states += 1

        # 매 상태마다 시간을 읽는 비용을 줄이기 위해
        # 256개 상태마다 제한 시간을 확인한다.
        if (
            deadline is not None
            and expanded_states % 256 == 0
            and time.monotonic() >= deadline
        ):
            raise RuntimeError("yen_time_limit")
        if expanded_states > 1_000_000:
            raise RuntimeError("search_state_cap")

        node, previous_arc, history = state

        if node == t and (
            end_arcs is None or previous_arc in end_arcs
        ):
            path = []
            state_path = [state]
            cursor = state

            while cursor in parent:
                previous_state, arc_id = parent[cursor]
                path.append(arc_id)
                state_path.append(previous_state)
                cursor = previous_state

            path.reverse()
            state_path.reverse()

            if return_state_path:
                return (
                    current_cost,
                    path,
                    expanded_states,
                    state_path,
                )

            return current_cost, path, expanded_states

        # # 중간 상태에서 재개할 때도 이전 Arc의 연결 조건을 사용한다.
        if previous_arc == -1:
            choices = (
                (arc_id, 0, 0)
                for arc_id in outs[node]
            )
        else:
            choices = trans.get(previous_arc, ())

        for arc_id, complex_proxy, turn_proxy in choices:
            # # start_arcs는 이번 탐색의 첫 번째 이동에만 적용한다.
            if (
                state == start_state
                and start_arcs is not None
                and arc_id not in start_arcs
            ):
                continue

            if (state, arc_id) in blocked_moves:
                continue

            next_history = rules.advance(history, arc_id)

            if next_history is None:
                continue

            next_node = arcs[arc_id][1]
            next_state = (
                next_node,
                arc_id,
                next_history,
            )

            if next_state in blocked_states:
                continue

            transition_cost = 0.0

            if weights is not None:
                transition_cost = (
                    weights[3] * complex_proxy
                    + weights[4] * turn_proxy
                )

            next_cost = (
                current_cost
                + costs[arc_id]
                + transition_cost
            )

            if next_cost >= best.get(next_state, float("inf")):
                continue

            best[next_state] = next_cost
            parent[next_state] = (state, arc_id)

            if not use_h:
                heuristic = 0.0

            elif heuristic_distances is not None:
                heuristic = heuristic_distances.get(
                    next_node
                )

                # 제한을 무시한 도로망에서도 목적지에 도달하지
                # 못하는 노드는 실제 탐색에서도 도달할 수 없다.
                if heuristic is None:
                    continue

            else:
                heuristic = (
                    math.dist(xy[next_node], xy[t])
                    * mins[name]
                )

            serial += 1

            heapq.heappush(
                queue,
                (
                    next_cost + heuristic,
                    serial,
                    next_cost,
                    next_state,
                ),
            )

    raise RuntimeError("no_route_in_supported_graph")
