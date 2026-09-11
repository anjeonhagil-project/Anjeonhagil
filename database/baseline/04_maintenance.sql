/*
===============================================================================
안전하길 DB 
04_maintenance.sql
===============================================================================
[기능]
- 30일이 지난 탈퇴 대상 회원을 Backend가 찾을 수 있는 조회 함수
- 사용자별 recent_searches를 최신 N개만 유지하는 정리 함수

[중요]
- auth.users 실제 삭제는 이 SQL에서 하지 않는다.
- 30일 경과 회원은 Node/Express Backend가 Supabase Admin API deleteUser()로 삭제한다.
- auth.users 삭제 후 public.users 및 CASCADE 연결 데이터가 정리된다.
- route_requests 보존기간은 아직 별도 확정하지 않았으므로 자동 삭제 함수를 만들지 않는다.
===============================================================================
*/

BEGIN;

SET LOCAL search_path = public, extensions, gis;

-- ============================================================================
-- 1) 탈퇴 30일 경과 대상 조회
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_withdrawal_cleanup_candidates(
    p_retention_days integer DEFAULT 30
)
RETURNS TABLE (
    user_id uuid,
    email varchar(255),
    withdrawn_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        u.id,
        u.email,
        u.withdrawn_at
    FROM public.users AS u
    WHERE u.is_active = false
      AND u.withdrawn_at IS NOT NULL
      AND u.withdrawn_at <= now() - make_interval(days => GREATEST(p_retention_days, 0))
    ORDER BY u.withdrawn_at ASC;
$$;

COMMENT ON FUNCTION public.list_withdrawal_cleanup_candidates(integer) IS
'탈퇴 보존기간이 지난 public.users를 조회한다. 실제 auth.users 삭제는 Backend의 Supabase Admin API에서 수행한다.';

-- 사용 예:
-- SELECT * FROM public.list_withdrawal_cleanup_candidates(30);

-- ============================================================================
-- 2) 최근검색 최신 N개 유지
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prune_recent_searches(
    p_user_id uuid,
    p_keep integer DEFAULT 20
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_deleted integer;
BEGIN
    IF p_keep < 1 OR p_keep > 100 THEN
        RAISE EXCEPTION 'p_keep must be between 1 and 100';
    END IF;

    WITH doomed AS (
        SELECT rs.id
        FROM public.recent_searches AS rs
        WHERE rs.user_id = p_user_id
        ORDER BY rs.searched_at DESC, rs.id DESC
        OFFSET p_keep
    )
    DELETE FROM public.recent_searches AS rs
    USING doomed
    WHERE rs.id = doomed.id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.prune_recent_searches(uuid, integer) IS
'사용자 recent_searches를 searched_at 최신순 N개만 남기고 초과 행을 삭제한다. Backend가 최근검색 upsert 후 호출 가능.';

-- 사용 예:
-- SELECT public.prune_recent_searches('<USER_UUID>'::uuid, 20);

COMMIT;
