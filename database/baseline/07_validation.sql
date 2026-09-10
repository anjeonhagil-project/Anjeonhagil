/*
===============================================================================
안전하길 DB
07_validation.sql
===============================================================================
[기능]
- Extension / Core 22 / 컬럼 225 / FK 31 / 공간컬럼 9 검증
- Core 22의 RLS 활성화 여부 검증
- 제거하기로 한 과거/과설계 테이블이 남아있는지 검증
- Seed 상태 확인
- hard schema 오류는 EXCEPTION, 아직 데이터 적재가 필요한 항목은 WARNING

[실행 시점]
- 00~06 실행 후
- 강남구 경계/원천 데이터 적재 전에도 실행 가능
  (service_area 미적재는 WARNING)
===============================================================================
*/

SET search_path = public, extensions, gis;

-- ============================================================================
-- 1) 사람이 바로 확인하는 요약
-- ============================================================================

SELECT 'extensions' AS check_group, extname AS item, extversion AS result
FROM pg_extension
WHERE extname IN ('postgis','pgrouting')
ORDER BY extname;

WITH expected(table_name) AS (
    VALUES
        ('users'),
        ('user_term_agreements'),
        ('driving_preferences'),
        ('favorite_places'),
        ('recent_searches'),
        ('routing_policies'),
        ('route_requests'),
        ('route_candidates'),
        ('route_candidate_links'),
        ('admins'),
        ('admin_audit_logs'),
        ('datasets'),
        ('data_update_logs'),
        ('service_areas'),
        ('road_nodes'),
        ('road_links'),
        ('road_turns'),
        ('road_link_features'),
        ('road_risk_scores'),
        ('traffic_accidents'),
        ('notices'),
        ('inquiries')
)
SELECT
    'core_table' AS check_group,
    e.table_name AS item,
    CASE WHEN t.table_name IS NULL THEN 'MISSING' ELSE 'OK' END AS result
FROM expected e
LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public'
   AND t.table_name = e.table_name
ORDER BY e.table_name;

-- RLS 상태
WITH expected(table_name) AS (
    VALUES
        ('users'),
        ('user_term_agreements'),
        ('driving_preferences'),
        ('favorite_places'),
        ('recent_searches'),
        ('routing_policies'),
        ('route_requests'),
        ('route_candidates'),
        ('route_candidate_links'),
        ('admins'),
        ('admin_audit_logs'),
        ('datasets'),
        ('data_update_logs'),
        ('service_areas'),
        ('road_nodes'),
        ('road_links'),
        ('road_turns'),
        ('road_link_features'),
        ('road_risk_scores'),
        ('traffic_accidents'),
        ('notices'),
        ('inquiries')
)
SELECT
    e.table_name,
    c.relrowsecurity AS rls_enabled
FROM expected e
JOIN pg_class c ON c.relname = e.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
ORDER BY e.table_name;

-- ============================================================================
-- 2) Hard validation
-- ============================================================================

DO $$
DECLARE
    v_missing_tables integer;
    v_core_columns integer;
    v_core_fks integer;
    v_spatial_columns integer;
    v_rls_off integer;
    v_stale_tables integer;
    v_extension_count integer;
BEGIN
    -- Extension 2개
    SELECT count(*)
    INTO v_extension_count
    FROM pg_extension
    WHERE extname IN ('postgis','pgrouting');

    IF v_extension_count <> 2 THEN
        RAISE EXCEPTION 'Extension validation failed: expected postgis+pgrouting (2), got %',
            v_extension_count;
    END IF;

    -- Core 22 존재
    WITH expected(table_name) AS (
        VALUES
            ('users'),
        ('user_term_agreements'),
        ('driving_preferences'),
        ('favorite_places'),
        ('recent_searches'),
        ('routing_policies'),
        ('route_requests'),
        ('route_candidates'),
        ('route_candidate_links'),
        ('admins'),
        ('admin_audit_logs'),
        ('datasets'),
        ('data_update_logs'),
        ('service_areas'),
        ('road_nodes'),
        ('road_links'),
        ('road_turns'),
        ('road_link_features'),
        ('road_risk_scores'),
        ('traffic_accidents'),
        ('notices'),
        ('inquiries')
    )
    SELECT count(*)
    INTO v_missing_tables
    FROM expected e
    LEFT JOIN information_schema.tables t
        ON t.table_schema = 'public'
       AND t.table_name = e.table_name
    WHERE t.table_name IS NULL;

    IF v_missing_tables <> 0 THEN
        RAISE EXCEPTION 'Core table validation failed: % expected tables missing',
            v_missing_tables;
    END IF;

    -- FINAL v8 expected columns = 225
    WITH expected(table_name) AS (
        VALUES
            ('users'),
        ('user_term_agreements'),
        ('driving_preferences'),
        ('favorite_places'),
        ('recent_searches'),
        ('routing_policies'),
        ('route_requests'),
        ('route_candidates'),
        ('route_candidate_links'),
        ('admins'),
        ('admin_audit_logs'),
        ('datasets'),
        ('data_update_logs'),
        ('service_areas'),
        ('road_nodes'),
        ('road_links'),
        ('road_turns'),
        ('road_link_features'),
        ('road_risk_scores'),
        ('traffic_accidents'),
        ('notices'),
        ('inquiries')
    )
    SELECT count(*)
    INTO v_core_columns
    FROM information_schema.columns c
    JOIN expected e ON e.table_name = c.table_name
    WHERE c.table_schema = 'public';

    IF v_core_columns <> 225 THEN
        RAISE EXCEPTION 'Column validation failed: expected 225, got %', v_core_columns;
    END IF;

    -- FINAL v8 expected FK = 31
    WITH expected(table_name) AS (
        VALUES
            ('users'),
        ('user_term_agreements'),
        ('driving_preferences'),
        ('favorite_places'),
        ('recent_searches'),
        ('routing_policies'),
        ('route_requests'),
        ('route_candidates'),
        ('route_candidate_links'),
        ('admins'),
        ('admin_audit_logs'),
        ('datasets'),
        ('data_update_logs'),
        ('service_areas'),
        ('road_nodes'),
        ('road_links'),
        ('road_turns'),
        ('road_link_features'),
        ('road_risk_scores'),
        ('traffic_accidents'),
        ('notices'),
        ('inquiries')
    )
    SELECT count(*)
    INTO v_core_fks
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN expected e ON e.table_name = cls.relname
    WHERE ns.nspname = 'public'
      AND con.contype = 'f';

    IF v_core_fks <> 31 THEN
        RAISE EXCEPTION 'FK validation failed: expected 31, got %', v_core_fks;
    END IF;

    -- 공간 컬럼 9
    WITH expected(table_name) AS (
        VALUES
            ('users'),
        ('user_term_agreements'),
        ('driving_preferences'),
        ('favorite_places'),
        ('recent_searches'),
        ('routing_policies'),
        ('route_requests'),
        ('route_candidates'),
        ('route_candidate_links'),
        ('admins'),
        ('admin_audit_logs'),
        ('datasets'),
        ('data_update_logs'),
        ('service_areas'),
        ('road_nodes'),
        ('road_links'),
        ('road_turns'),
        ('road_link_features'),
        ('road_risk_scores'),
        ('traffic_accidents'),
        ('notices'),
        ('inquiries')
    )
    SELECT count(*)
    INTO v_spatial_columns
    FROM geometry_columns g
    JOIN expected e ON e.table_name = g.f_table_name
    WHERE g.f_table_schema = 'public';

    IF v_spatial_columns <> 9 THEN
        RAISE EXCEPTION 'Spatial column validation failed: expected 9, got %',
            v_spatial_columns;
    END IF;

    -- Core 22 RLS 모두 ON
    WITH expected(table_name) AS (
        VALUES
            ('users'),
        ('user_term_agreements'),
        ('driving_preferences'),
        ('favorite_places'),
        ('recent_searches'),
        ('routing_policies'),
        ('route_requests'),
        ('route_candidates'),
        ('route_candidate_links'),
        ('admins'),
        ('admin_audit_logs'),
        ('datasets'),
        ('data_update_logs'),
        ('service_areas'),
        ('road_nodes'),
        ('road_links'),
        ('road_turns'),
        ('road_link_features'),
        ('road_risk_scores'),
        ('traffic_accidents'),
        ('notices'),
        ('inquiries')
    )
    SELECT count(*)
    INTO v_rls_off
    FROM expected e
    JOIN pg_class c ON c.relname = e.table_name
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relrowsecurity = false;

    IF v_rls_off <> 0 THEN
        RAISE EXCEPTION 'RLS validation failed: % core tables have RLS disabled', v_rls_off;
    END IF;

    -- 제거 대상 테이블은 없어야 함
    SELECT count(*)
    INTO v_stale_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'auth_accounts',
        'user_sessions',
        'email_verifications',
        'admin_sessions',
        'navigation_sessions',
        'route_guidance_steps',
        'road_reports'
      );

    IF v_stale_tables <> 0 THEN
        RAISE EXCEPTION 'Stale/removed table validation failed: % removed tables still exist',
            v_stale_tables;
    END IF;

    RAISE NOTICE 'FINAL v8 hard schema validation PASSED';
END
$$;

-- ============================================================================
-- 3) Seed / 운영 준비 상태 (WARNING 성격)
-- ============================================================================

DO $$
DECLARE
    v_active_policy integer;
    v_dataset_count integer;
    v_active_service_area integer;
BEGIN
    SELECT count(*) INTO v_active_policy
    FROM public.routing_policies
    WHERE is_active = true;

    IF v_active_policy <> 1 THEN
        RAISE WARNING 'Expected exactly 1 active routing policy, got %', v_active_policy;
    ELSE
        RAISE NOTICE 'Routing policy seed OK';
    END IF;

    SELECT count(*) INTO v_dataset_count
    FROM public.datasets
    WHERE code IN (
        'TAAS_ACCIDENT','STANDARD_NODE','STANDARD_LINK',
        'STANDARD_TURN','ROAD_FEATURE','RISK_SCORE'
    );

    IF v_dataset_count <> 6 THEN
        RAISE WARNING 'Expected 6 base datasets, got %', v_dataset_count;
    ELSE
        RAISE NOTICE 'Dataset seed OK';
    END IF;

    SELECT count(*) INTO v_active_service_area
    FROM public.service_areas
    WHERE is_active = true;

    IF v_active_service_area < 1 THEN
        RAISE WARNING 'No active service_area yet. Load the approved Gangnam-gu 4326 boundary before routing.';
    ELSE
        RAISE NOTICE 'Active service_area exists';
    END IF;
END
$$;

-- ============================================================================
-- 4) 최종 숫자 확인
-- ============================================================================

WITH expected(table_name) AS (
    VALUES
        ('users'),
        ('user_term_agreements'),
        ('driving_preferences'),
        ('favorite_places'),
        ('recent_searches'),
        ('routing_policies'),
        ('route_requests'),
        ('route_candidates'),
        ('route_candidate_links'),
        ('admins'),
        ('admin_audit_logs'),
        ('datasets'),
        ('data_update_logs'),
        ('service_areas'),
        ('road_nodes'),
        ('road_links'),
        ('road_turns'),
        ('road_link_features'),
        ('road_risk_scores'),
        ('traffic_accidents'),
        ('notices'),
        ('inquiries')
),
stats AS (
    SELECT
        (SELECT count(*) FROM expected) AS expected_tables,
        (
            SELECT count(*)
            FROM information_schema.columns c
            JOIN expected e ON e.table_name = c.table_name
            WHERE c.table_schema = 'public'
        ) AS core_columns,
        (
            SELECT count(*)
            FROM pg_constraint con
            JOIN pg_class cls ON cls.oid = con.conrelid
            JOIN pg_namespace ns ON ns.oid = cls.relnamespace
            JOIN expected e ON e.table_name = cls.relname
            WHERE ns.nspname = 'public'
              AND con.contype = 'f'
        ) AS core_fks,
        (
            SELECT count(*)
            FROM geometry_columns g
            JOIN expected e ON e.table_name = g.f_table_name
            WHERE g.f_table_schema = 'public'
        ) AS spatial_columns
)
SELECT
    expected_tables,   -- 22
    core_columns,      -- 225
    core_fks,          -- 31
    spatial_columns    -- 9
FROM stats;
