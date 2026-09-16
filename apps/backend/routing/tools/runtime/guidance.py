"""Selected directed arcs -> guidance; never reroute or alter ranking/features.

Hints describe graph junction direction, not surveyed lane/sign instructions.
Geometry within an arc is not mistaken for an intersection.
"""
import math
from shapely.geometry import LineString
from shapely.ops import substring


def bearing(a, b):
    return math.degrees(math.atan2(b[0]-a[0], b[1]-a[1]))


def build_guidance(service, graph, segments):
    if not segments or len(segments) > 20000:
        raise ValueError('INVALID_GUIDANCE_SEGMENTS')
    # Reuse frozen eligibility/turn-sequence validator before emitting hints.
    service.calc.evaluate(segments_request(service, segments))
    pieces = []
    for segment in segments:
        aid = segment['arc_id']
        node, line = service.edges[aid//2]
        if graph.arcs[aid][0] != node:
            line = LineString(list(line.coords)[::-1])
        piece = substring(line, segment.get('start_fraction', 0), segment.get('end_fraction', 1), normalized=True)
        if piece.length > .01:
            pieces.append((aid, piece))
    coordinates, steps = [], []
    for index, (aid, piece) in enumerate(pieces):
        first_index = max(0, len(coordinates)-1)
        if coordinates:
            previous_aid, previous = pieces[index-1]
            if graph.arcs[previous_aid][1] != graph.arcs[aid][0]:
                raise ValueError('DISCONNECTED_GUIDANCE')
            incoming = bearing(previous.interpolate(max(0, previous.length-12)).coords[0], previous.coords[-1])
            outgoing = bearing(piece.coords[0], piece.interpolate(min(12, piece.length)).coords[0])
            angle = (outgoing-incoming+180) % 360-180
            junction = len(graph.outs[graph.arcs[aid][0]]) > 1
            if abs(angle) >= (25 if junction else 55):
                kind = 'uturn' if abs(angle) >= 150 else ('right' if angle > 0 else 'left')
                label = {'uturn':'되돌아가는 방향', 'right':'오른쪽 방향', 'left':'왼쪽 방향'}[kind]
                steps.append({'coordinate_index':first_index,'kind':kind,'instruction':label+'으로 경로를 따라가세요','junction':junction})
        for x, y in piece.coords:
            point = list(service.to_ll.transform(x, y))
            if not coordinates or point != coordinates[-1]:
                coordinates.append(point)
    if len(coordinates) < 2:
        raise ValueError('EMPTY_GUIDANCE')
    steps.append({'coordinate_index':len(coordinates)-1,'kind':'arrival','instruction':'경로 끝 지점'})
    return {'version':'graph_guidance_v1','geometry':{'type':'LineString','coordinates':coordinates},'steps':steps,
            'notice':'도로 연결·방향 기반 참고 안내입니다. 차선·신호·현장 표지를 확인하세요.'}


def segments_request(service, segments):
    from interface import VERSIONS
    return {**VERSIONS, 'segments':segments}
