/*
===============================================================================
안전하길 DB
02_indexes.sql
===============================================================================
[기능]
- 검색/관리자 조회/경로 로그/ETL 조회 성능을 위한 B-tree 인덱스 생성
- geometry 컬럼 9개의 GiST 공간 인덱스 생성
- Partial UNIQUE 인덱스로 도메인 규칙 보강
  · Local username 중복 방지
  · home/work 각 1개
  · 최근검색 동일 Kakao 장소 중복 방지
  · routing policy 활성 버전 1개
  · 요청별 선택 경로 최대 1개

[실행 시점]
- 01_schema.sql 직후
- 신규 구축에서는 ETL 대량 적재 전에 실행해도 되지만,
  아주 큰 원천데이터 최초 적재 성능이 중요하면 적재 후 생성 가능
===============================================================================
*/

BEGIN;

SET LOCAL search_path = public, extensions, gis;

-- ============================================================================
-- UNIQUE / 도메인 규칙
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username
    ON public.users (username)
    WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_favorite_places_user_fixed_type
    ON public.favorite_places (user_id, place_type)
    WHERE place_type IN ('home','work');

CREATE UNIQUE INDEX IF NOT EXISTS uq_recent_searches_user_provider_place
    ON public.recent_searches (user_id, provider, provider_place_id)
    WHERE provider_place_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_routing_policies_one_active
    ON public.routing_policies (is_active)
    WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_route_candidates_one_selected
    ON public.route_candidates (route_request_id)
    WHERE is_selected = true;

-- ============================================================================
-- 회원 / 사용자 설정
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email
    ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_signup_provider
    ON public.users (signup_provider);
CREATE INDEX IF NOT EXISTS idx_users_is_active
    ON public.users (is_active);
CREATE INDEX IF NOT EXISTS idx_users_withdrawn_at
    ON public.users (withdrawn_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at
    ON public.users (created_at);

CREATE INDEX IF NOT EXISTS idx_driving_preferences_updated_at
    ON public.driving_preferences (updated_at);

CREATE INDEX IF NOT EXISTS idx_favorite_places_user_id
    ON public.favorite_places (user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_places_provider_place_id
    ON public.favorite_places (provider_place_id);

CREATE INDEX IF NOT EXISTS idx_recent_searches_user_id
    ON public.recent_searches (user_id);
CREATE INDEX IF NOT EXISTS idx_recent_searches_searched_at
    ON public.recent_searches (searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_searches_user_recent
    ON public.recent_searches (user_id, searched_at DESC, id DESC);

-- ============================================================================
-- 관리자 / ETL
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_admins_email
    ON public.admins (email);
CREATE INDEX IF NOT EXISTS idx_admins_role
    ON public.admins (role);
CREATE INDEX IF NOT EXISTS idx_admins_is_active
    ON public.admins (is_active);
CREATE INDEX IF NOT EXISTS idx_admins_granted_by
    ON public.admins (granted_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_admins_last_login_at
    ON public.admins (last_login_at);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
    ON public.admin_audit_logs (actor_admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target
    ON public.admin_audit_logs (target_admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action
    ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at
    ON public.admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_datasets_is_active
    ON public.datasets (is_active);

CREATE INDEX IF NOT EXISTS idx_data_update_logs_dataset
    ON public.data_update_logs (dataset_id);
CREATE INDEX IF NOT EXISTS idx_data_update_logs_status
    ON public.data_update_logs (status);
CREATE INDEX IF NOT EXISTS idx_data_update_logs_trigger_type
    ON public.data_update_logs (trigger_type);
CREATE INDEX IF NOT EXISTS idx_data_update_logs_source_version
    ON public.data_update_logs (source_version);
CREATE INDEX IF NOT EXISTS idx_data_update_logs_executed_by
    ON public.data_update_logs (executed_by);
CREATE INDEX IF NOT EXISTS idx_data_update_logs_started_at
    ON public.data_update_logs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_update_logs_finished_at
    ON public.data_update_logs (finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_update_logs_dataset_finished
    ON public.data_update_logs (dataset_id, finished_at DESC)
    WHERE finished_at IS NOT NULL;

-- ============================================================================
-- 공간 / 도로망 / 모델
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_service_areas_name
    ON public.service_areas (name);
CREATE INDEX IF NOT EXISTS idx_service_areas_is_active
    ON public.service_areas (is_active);

CREATE INDEX IF NOT EXISTS idx_road_nodes_node_type
    ON public.road_nodes (node_type);
CREATE INDEX IF NOT EXISTS idx_road_nodes_is_intersection
    ON public.road_nodes (is_intersection);
CREATE INDEX IF NOT EXISTS idx_road_nodes_source_updated_at
    ON public.road_nodes (source_updated_at);

CREATE INDEX IF NOT EXISTS idx_road_links_from_node
    ON public.road_links (from_node_id);
CREATE INDEX IF NOT EXISTS idx_road_links_to_node
    ON public.road_links (to_node_id);
CREATE INDEX IF NOT EXISTS idx_road_links_road_name
    ON public.road_links (road_name);
CREATE INDEX IF NOT EXISTS idx_road_links_road_class
    ON public.road_links (road_class);
CREATE INDEX IF NOT EXISTS idx_road_links_one_way
    ON public.road_links (one_way);
CREATE INDEX IF NOT EXISTS idx_road_links_source_updated_at
    ON public.road_links (source_updated_at);

CREATE INDEX IF NOT EXISTS idx_road_turns_via_node
    ON public.road_turns (via_node_id);
CREATE INDEX IF NOT EXISTS idx_road_turns_from_link
    ON public.road_turns (from_road_link_id);
CREATE INDEX IF NOT EXISTS idx_road_turns_to_link
    ON public.road_turns (to_road_link_id);
CREATE INDEX IF NOT EXISTS idx_road_turns_turn_type
    ON public.road_turns (turn_type);
CREATE INDEX IF NOT EXISTS idx_road_turns_is_allowed
    ON public.road_turns (is_allowed);
CREATE INDEX IF NOT EXISTS idx_road_turns_source_updated_at
    ON public.road_turns (source_updated_at);

CREATE INDEX IF NOT EXISTS idx_road_link_features_feature_version
    ON public.road_link_features (feature_version);
CREATE INDEX IF NOT EXISTS idx_road_link_features_updated_at
    ON public.road_link_features (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_road_risk_scores_model_version
    ON public.road_risk_scores (model_version);
CREATE INDEX IF NOT EXISTS idx_road_risk_scores_generated_log
    ON public.road_risk_scores (generated_by_update_log_id);
CREATE INDEX IF NOT EXISTS idx_road_risk_scores_calculated_at
    ON public.road_risk_scores (calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_road_risk_scores_version_time
    ON public.road_risk_scores (risk_version, time_bucket);

CREATE INDEX IF NOT EXISTS idx_traffic_accidents_occurred_at
    ON public.traffic_accidents (occurred_at);
CREATE INDEX IF NOT EXISTS idx_traffic_accidents_type
    ON public.traffic_accidents (accident_type);
CREATE INDEX IF NOT EXISTS idx_traffic_accidents_severity
    ON public.traffic_accidents (severity);
CREATE INDEX IF NOT EXISTS idx_traffic_accidents_matched_link
    ON public.traffic_accidents (matched_road_link_id);
CREATE INDEX IF NOT EXISTS idx_traffic_accidents_source_updated_at
    ON public.traffic_accidents (source_updated_at);

-- ============================================================================
-- 라우팅 요청 / 후보
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_route_requests_user_id
    ON public.route_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_route_requests_navigation_run
    ON public.route_requests (navigation_run_id);
CREATE INDEX IF NOT EXISTS idx_route_requests_parent
    ON public.route_requests (parent_request_id);
CREATE INDEX IF NOT EXISTS idx_route_requests_request_type
    ON public.route_requests (request_type);
CREATE INDEX IF NOT EXISTS idx_route_requests_origin_admin_code
    ON public.route_requests (origin_admin_code);
CREATE INDEX IF NOT EXISTS idx_route_requests_origin_admin_name
    ON public.route_requests (origin_admin_name);
CREATE INDEX IF NOT EXISTS idx_route_requests_origin_node
    ON public.route_requests (origin_node_id);
CREATE INDEX IF NOT EXISTS idx_route_requests_destination_admin_code
    ON public.route_requests (destination_admin_code);
CREATE INDEX IF NOT EXISTS idx_route_requests_destination_admin_name
    ON public.route_requests (destination_admin_name);
CREATE INDEX IF NOT EXISTS idx_route_requests_destination_node
    ON public.route_requests (destination_node_id);
CREATE INDEX IF NOT EXISTS idx_route_requests_max_detour
    ON public.route_requests (max_detour_minutes);
CREATE INDEX IF NOT EXISTS idx_route_requests_routing_policy
    ON public.route_requests (routing_policy_id);
CREATE INDEX IF NOT EXISTS idx_route_requests_risk_version
    ON public.route_requests (risk_version);
CREATE INDEX IF NOT EXISTS idx_route_requests_status
    ON public.route_requests (status);
CREATE INDEX IF NOT EXISTS idx_route_requests_failure_code
    ON public.route_requests (failure_code);
CREATE INDEX IF NOT EXISTS idx_route_requests_fingerprint
    ON public.route_requests (input_fingerprint);
CREATE INDEX IF NOT EXISTS idx_route_requests_started_at
    ON public.route_requests (started_at);
CREATE INDEX IF NOT EXISTS idx_route_requests_completed_at
    ON public.route_requests (completed_at);
CREATE INDEX IF NOT EXISTS idx_route_requests_created_at
    ON public.route_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_requests_user_created
    ON public.route_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_requests_status_created
    ON public.route_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_requests_navigation_created
    ON public.route_requests (navigation_run_id, created_at)
    WHERE navigation_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_route_candidates_route_type
    ON public.route_candidates (route_type);

CREATE INDEX IF NOT EXISTS idx_route_candidate_links_road_link
    ON public.route_candidate_links (road_link_id);

-- ============================================================================
-- 공지 / 문의
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notices_title
    ON public.notices (title);
CREATE INDEX IF NOT EXISTS idx_notices_is_published
    ON public.notices (is_published);
CREATE INDEX IF NOT EXISTS idx_notices_published_at
    ON public.notices (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_created_by
    ON public.notices (created_by);

CREATE INDEX IF NOT EXISTS idx_inquiries_user_id
    ON public.inquiries (user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_category
    ON public.inquiries (category);
CREATE INDEX IF NOT EXISTS idx_inquiries_status
    ON public.inquiries (status);
CREATE INDEX IF NOT EXISTS idx_inquiries_answered_by
    ON public.inquiries (answered_by);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at
    ON public.inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_answered_at
    ON public.inquiries (answered_at DESC);

-- ============================================================================
-- PostGIS GiST 공간 인덱스 (FINAL v8 공간 컬럼 9개)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_favorite_places_geom_gist
    ON public.favorite_places USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_recent_searches_geom_gist
    ON public.recent_searches USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_route_requests_origin_geom_gist
    ON public.route_requests USING GIST (origin_geom);

CREATE INDEX IF NOT EXISTS idx_route_requests_destination_geom_gist
    ON public.route_requests USING GIST (destination_geom);

CREATE INDEX IF NOT EXISTS idx_route_candidates_geom_gist
    ON public.route_candidates USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_service_areas_geom_gist
    ON public.service_areas USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_road_nodes_geom_gist
    ON public.road_nodes USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_road_links_geom_gist
    ON public.road_links USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_traffic_accidents_geom_gist
    ON public.traffic_accidents USING GIST (geom);

COMMIT;
