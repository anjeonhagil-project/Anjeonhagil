// 기능: Anjeonhagil의 버전, 6개 부담요소 순서, Q3 선택지를 백엔드에서 공유한다. 실제 API 연결은 기존 routes 모듈에서 진행한다.
export const RELEASE_ID = 'anjeon_final_20260915_child100_v3'
export const VERSIONS = Object.freeze({
    contract_version: 'anjeon_contract_v6_child100',
    dataset_version: 'seoul_static_20260915_review2',
    feature_version: 'static_burden_v5_child_circle_inside',
    eta_version: 'internal_hourly_topis_v1',
    routing_policy_version: 'review_exclusion_v1',
})
export const FACTOR_ORDER = Object.freeze([
    'COMPLEX_INTERSECTION', 'MERGE_BRANCH', 'NARROW_ROAD',
    'UNFAMILIAR_TURN', 'CONSECUTIVE_ACTION', 'CHILD_ZONE_NEARBY',
])
export const FACTOR_UNITS = Object.freeze(['count', 'score*m', 'score*m', 'count', 'count', 'm'])
export const DETOUR_MINUTES = Object.freeze([0, 5, 10, 15])
export const DRIVING_FREQUENCIES = Object.freeze(['daily', 'weekly', 'monthly', 'rarely', 'never'])
