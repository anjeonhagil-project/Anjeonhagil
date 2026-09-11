/*
===============================================================================
안전하길 DB
05_security.sql
===============================================================================
[기능]
- Core 22개 public 테이블 모두 RLS 활성화
- anon / authenticated의 직접 Table CRUD 권한 제거
- 유지보수 함수의 직접 실행도 차단
- 서비스 CRUD는 Express Backend의 서버 전용 Supabase Secret/Service 권한으로 수행

[중요]
- 현재 아키텍처는 React가 public DB를 직접 CRUD하지 않는다.
- 따라서 의도적으로 사용자용 RLS Policy를 만들지 않는다.
- RLS ON + Policy 없음 = anon/authenticated 직접 접근 차단.
- 향후 notices 등을 브라우저에서 직접 조회하고 싶다면 migration으로 최소 SELECT Policy만 추가한다.
===============================================================================
*/

BEGIN;

-- ============================================================================
-- RLS ENABLE
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_term_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driving_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_candidate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_update_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_link_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_accidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Browser 역할 직접 접근 차단
-- ============================================================================

REVOKE ALL PRIVILEGES ON TABLE
    public.users,
    public.user_term_agreements,
    public.driving_preferences,
    public.favorite_places,
    public.recent_searches,
    public.routing_policies,
    public.route_requests,
    public.route_candidates,
    public.route_candidate_links,
    public.admins,
    public.admin_audit_logs,
    public.datasets,
    public.data_update_logs,
    public.service_areas,
    public.road_nodes,
    public.road_links,
    public.road_turns,
    public.road_link_features,
    public.road_risk_scores,
    public.traffic_accidents,
    public.notices,
    public.inquiries
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
FROM anon, authenticated;

-- 앞으로 같은 owner로 생성되는 public Table/Sequence에도 기본 최소권한 적용
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ============================================================================
-- 함수 직접 호출 차단
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.list_withdrawal_cleanup_candidates(integer)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.prune_recent_searches(uuid, integer)
FROM PUBLIC, anon, authenticated;

-- Backend service_role이 maintenance 함수 호출 가능
GRANT EXECUTE ON FUNCTION public.list_withdrawal_cleanup_candidates(integer)
TO service_role;

GRANT EXECUTE ON FUNCTION public.prune_recent_searches(uuid, integer)
TO service_role;

-- Trigger helper는 외부 API 호출 대상이 아님
REVOKE EXECUTE ON FUNCTION public.set_updated_at()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.set_notice_published_at()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.set_route_candidate_selected_at()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.set_inquiry_answered_at()
FROM PUBLIC, anon, authenticated;

COMMIT;
