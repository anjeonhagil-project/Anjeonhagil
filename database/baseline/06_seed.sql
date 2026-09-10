/*
===============================================================================
안전하길 DB
06_seed.sql
===============================================================================
[기능]
- routing_policies MVP 초기 v1 생성
- datasets 6종 마스터 생성
- Super Admin / 강남구 service_area 생성 방법을 안전한 템플릿으로 제공

[중요]
- 강남구 geometry는 실제 확정한 4326 경계 파일을 사용해야 하므로 자동으로 가짜 Polygon을 넣지 않는다.
- Super Admin도 먼저 Supabase Auth에 실제 사용자를 만든 뒤 해당 auth.users.id를 넣는다.
===============================================================================
*/

BEGIN;

SET LOCAL search_path = public, extensions, gis;

-- ============================================================================
-- 1) 데이터셋 마스터
-- ============================================================================

INSERT INTO public.datasets
    (code, name, source_name, description, update_method, update_cycle, is_active)
VALUES
    ('TAAS_ACCIDENT',
     'TAAS 사고 데이터',
     'TAAS',
     '사고 위치/유형/심각도 원천 및 링크 매칭용 데이터',
     'batch', NULL, true),

    ('STANDARD_NODE',
     '표준 노드',
     '표준노드링크',
     '도로 네트워크 Node 원천',
     'batch', NULL, true),

    ('STANDARD_LINK',
     '표준 링크',
     '표준노드링크',
     '도로 네트워크 Link 원천',
     'batch', NULL, true),

    ('STANDARD_TURN',
     '표준 Turn',
     '표준노드링크',
     '좌/우회전·유턴·회전제한 원천',
     'batch', NULL, true),

    ('ROAD_FEATURE',
     '도로 전처리 Feature',
     '안전하길 ETL',
     '설문 5요소 및 사고 관련 링크별 전처리 Feature',
     'batch', NULL, true),

    ('RISK_SCORE',
     '도로 위험도 사전계산',
     '안전하길 모델',
     '링크별 객관 위험 score/cost 버전 데이터',
     'batch', NULL, true)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    source_name = EXCLUDED.source_name,
    description = EXCLUDED.description,
    update_method = EXCLUDED.update_method,
    update_cycle = EXCLUDED.update_cycle,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- ============================================================================
-- 2) 라우팅 정책 v1
--    1~2 -> 0.2 / 3 -> 0.5 / 4~5 -> 1.0
--    객관위험 0.7 / 개인화 penalty 0.3
-- ============================================================================

-- Partial UNIQUE(one active) 충돌을 피하기 위해 기존 active를 먼저 해제
UPDATE public.routing_policies
SET is_active = false
WHERE is_active = true
  AND version <> 'v1';

INSERT INTO public.routing_policies (
    version,
    survey_weight_map,
    objective_weight,
    preference_weight,
    normalization_method,
    config,
    rationale,
    is_active,
    effective_from
)
VALUES (
    'v1',
    '{"1":0.2,"2":0.2,"3":0.5,"4":1.0,"5":1.0}'::jsonb,
    0.7000,
    0.3000,
    'configurable',
    '{
      "personalization_mode":"penalty_only",
      "expose_numeric_safety_score":false,
      "note":"MVP initial policy; calibrate after validation"
    }'::jsonb,
    '멘토 피드백 기반 MVP 초기 정책. 객관위험은 개인화로 감소시키지 않고 사용자 기피요소를 추가 penalty로 반영한다.',
    true,
    now()
)
ON CONFLICT (version) DO UPDATE
SET
    survey_weight_map = EXCLUDED.survey_weight_map,
    objective_weight = EXCLUDED.objective_weight,
    preference_weight = EXCLUDED.preference_weight,
    normalization_method = EXCLUDED.normalization_method,
    config = EXCLUDED.config,
    rationale = EXCLUDED.rationale,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- 3) 강남구 service_area
--    실제 확정 경계 geometry를 사용한 뒤 아래 템플릿을 실행한다.
-- ============================================================================

/*
예시: GeoJSON "geometry 객체"를 직접 넣는 경우

INSERT INTO public.service_areas (
    area_code,
    name,
    geom,
    is_active,
    effective_from
)
VALUES (
    '<강남구_행정구역코드>',
    '강남구',
    ST_Multi(
        ST_SetSRID(
            ST_GeomFromGeoJSON('<MULTIPOLYGON_OR_POLYGON_GEOMETRY_JSON>'),
            4326
        )
    )::geometry(MultiPolygon,4326),
    true,
    CURRENT_DATE
)
ON CONFLICT (area_code) DO UPDATE
SET
    name = EXCLUDED.name,
    geom = EXCLUDED.geom,
    is_active = EXCLUDED.is_active,
    effective_from = EXCLUDED.effective_from;

주의:
- ST_GeomFromGeoJSON은 FeatureCollection 전체가 아니라 geometry JSON을 받는다.
- 프로젝트에서 확정한 강남구 4326 경계파일을 기준으로 적재한다.
- 도로망 강남구+1km buffer는 service_areas.geom에 넣지 않는다.
*/

-- ============================================================================
-- 4) 최초 Super Admin
--    먼저 Supabase Auth에 관리자 사용자를 생성한 후 UUID/이메일 치환
-- ============================================================================

/*
INSERT INTO public.admins (
    id,
    email,
    role,
    is_active,
    granted_by_admin_id
)
VALUES (
    '<SUPABASE_AUTH_USER_UUID>'::uuid,
    lower('<ADMIN_EMAIL>'),
    'super_admin',
    true,
    NULL
);
*/

COMMIT;

-- Seed 확인
SELECT version, objective_weight, preference_weight, is_active
FROM public.routing_policies
ORDER BY created_at;

SELECT code, name, source_name, is_active
FROM public.datasets
ORDER BY id;
