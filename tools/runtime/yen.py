import heapq
import itertools

import search_engine as engine

def build_goal_entry_check(target):
    """목적지 진입이 확실히 차단됐는지 검사하는 함수를 만든다."""

    # 목적지로 직접 들어가는 도로
    incoming = {
        aid
        for aid, arc in engine.arcs.items()
        if arc[1] == target
    }

    # 이 도로를 지난 상태에는 제한 이력이 남을 가능성이 있다.
    history_end_arcs = {
        prefix[-1]
        for prefix in engine.rules.prefix
        if prefix
    }

    entries = []
    uncertain = False

    for previous_arc, choices in engine.trans.items():
        for aid, _, _ in choices:
            if aid not in incoming:
                continue

            if previous_arc in history_end_arcs:
                # 여러 제한 이력을 고려해야 하므로 조기 판정을 보류한다.
                uncertain = True
                continue

            # 이 도로로 끝나는 제한 접두사가 없으므로 이력은 비어 있다.
            entry_state = (
                engine.arcs[previous_arc][1],
                previous_arc,
                (),
            )

            next_history = engine.rules.advance((), aid)

            if next_history is None:
                continue

            goal_state = (
                target,
                aid,
                next_history,
            )

            entries.append(
                (entry_state, aid, goal_state)
            )

    def can_enter(initial_state, blocked_states, blocked_moves):
        """
        참: 진입 가능성을 배제할 수 없어 기존 탐색이 필요하다.
        거짓: 모든 진입이 막혀 탐색을 생략할 수 있다.
        """
        if initial_state[0] == target:
            return True

        if uncertain:
            return True

        # 최초 출발에는 이전 도로가 없으므로 직접 진입을 따로 확인한다.
        if initial_state[1] == -1:
            for aid in incoming:
                if engine.arcs[aid][0] != initial_state[0]:
                    continue

                history = engine.rules.advance((), aid)

                if history is None:
                    continue

                goal_state = (target, aid, history)

                if (
                    initial_state not in blocked_states
                    and (initial_state, aid) not in blocked_moves
                    and goal_state not in blocked_states
                ):
                    return True

        for entry_state, aid, goal_state in entries:
            if entry_state in blocked_states:
                continue

            if (entry_state, aid) in blocked_moves:
                continue

            if goal_state in blocked_states:
                continue

            # 해당 진입 상태까지 도달 가능한지는 기존 탐색이 확인한다.
            return True

        return False

    return can_enter

def prefix_costs(path, states, profile):
    """경로의 각 상태까지 누적된 비용을 계산한다."""
    weights = engine.profiles[profile]
    accumulated = [0.0]

    for index, arc_id in enumerate(path):
        previous_arc = states[index][1]
        turn_cost = 0.0

        if previous_arc != -1:
            transition = next(
                (
                    (complex_proxy, turn_proxy)
                    for next_arc, complex_proxy, turn_proxy
                    in engine.trans.get(previous_arc, ())
                    if next_arc == arc_id
                ),
                None,
            )

            if transition is None:
                raise ValueError("path contains an invalid transition")

            if weights is not None:
                complex_proxy, turn_proxy = transition
                turn_cost = (
                    weights[3] * complex_proxy
                    + weights[4] * turn_proxy
                )

        accumulated.append(
            accumulated[-1]
            + engine.base[profile][arc_id]
            + turn_cost
        )

    return accumulated


def yen_k_shortest(
    source,
    target,
    k,
    profile="distance",
    use_h=True,
):
    """
    고정 비용의 확장 상태 그래프에서 K개 경로를 구한다.
    반환:
        [
            {
                "cost": 총비용,
                "arc_ids": Arc 목록,
                "states": 확장 상태 목록,
            },
            ...
        ]
    유효 경로가 K개보다 적으면 발견한 경로만 반환한다.
    """
    if type(k) != int or k < 1:
        raise ValueError("k must be a positive integer")

    if source == target:
        raise ValueError("source and target must differ")

    # 목적지 진입 조건은 이번 후보 생성에서 한 번만 준비한다.
    can_enter_goal = build_goal_entry_check(target)

    try:
        cost, path, _, states = engine.search(
            source,
            target,
            profile,
            use_h=use_h,
            return_state_path=True,
        )
    except RuntimeError as error:
        if str(error) == "no_route_in_supported_graph":
            return []
        raise

    first = {
        "cost": cost,
        "arc_ids": path,
        "states": states,
    }

    accepted = [first]
    seen_paths = {tuple(path)}

    candidates = []
    serial = itertools.count()

    while len(accepted) < k:
        previous = accepted[-1]
        previous_path = previous["arc_ids"]
        previous_states = previous["states"]

        accumulated = prefix_costs(
            previous_path,
            previous_states,
            profile,
        )

        # 마지막 상태는 목적지이므로 분기점으로 사용하지 않는다.
        for split in range(len(previous_path)):
            root_arcs = previous_path[:split]
            root_states = previous_states[:split + 1]
            spur_state = root_states[-1]

            # 앞부분으로 돌아가는 것을 막되, 분기점 자체는 제외하지 않는다.
            blocked_states = set(root_states[:-1])
            blocked_moves = set()

            # 같은 앞부분을 가진 확정 경로들의 다음 이동을 제외한다.
            for route in accepted:
                route_path = route["arc_ids"]

                if (
                    len(route_path) > split
                    and route_path[:split] == root_arcs
                    and route["states"][:split + 1] == root_states
                ):
                    blocked_moves.add(
                        (spur_state, route_path[split])
                    )
                    
            # 목적지 진입이 모두 막혔다면 우회 탐색을 생략한다.
            if not can_enter_goal(
                spur_state,
                blocked_states,
                blocked_moves,
            ):
                continue

            try:
                (
                    spur_cost,
                    spur_arcs,
                    _,
                    spur_states,
                ) = engine.search(
                    spur_state[0],
                    target,
                    profile,
                    use_h=use_h,
                    initial_state=spur_state,
                    blocked_states=blocked_states,
                    blocked_moves=blocked_moves,
                    return_state_path=True,
                )
            except RuntimeError as error:
                if str(error) == "no_route_in_supported_graph":
                    continue

                # 탐색 한도 초과 등을 경로 없음으로 숨기지 않는다.
                raise

            combined_arcs = root_arcs + spur_arcs
            combined_states = root_states[:-1] + spur_states
            path_key = tuple(combined_arcs)

            if path_key in seen_paths:
                continue

            # 이 구현은 확장 상태가 반복되지 않는 경로를 다룬다.
            if len(combined_states) != len(set(combined_states)):
                raise AssertionError("repeated expanded state")

            candidate = {
                "cost": accumulated[split] + spur_cost,
                "arc_ids": combined_arcs,
                "states": combined_states,
            }

            heapq.heappush(
                candidates,
                (
                    candidate["cost"],
                    next(serial),
                    candidate,
                ),
            )
            seen_paths.add(path_key)

        # 후보 힙은 이전 반복에서 남은 후보를 계속 유지한다.
        if not candidates:
            break

        _, _, next_route = heapq.heappop(candidates)
        accepted.append(next_route)

    return accepted