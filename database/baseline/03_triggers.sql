/*
===============================================================================
안전하길 DB 
03_triggers.sql
===============================================================================
[기능]
- updated_at 자동 갱신
- 공지 게시 시 published_at 자동 보완
- 경로 후보 선택 시 selected_at 자동 보완
- 문의 답변 완료 시 answered_at 자동 보완

[원칙]
- Business 핵심 판단(경로 계산, 설문 가중치, 서비스지역 판정)은 Trigger에 숨기지 않음
- 단순 타임스탬프 일관성만 DB Trigger로 보조
===============================================================================
*/

BEGIN;

SET LOCAL search_path = public, extensions, gis;

-- ============================================================================
-- 공통 updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_driving_preferences_updated_at ON public.driving_preferences;
CREATE TRIGGER trg_driving_preferences_updated_at
BEFORE UPDATE ON public.driving_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_favorite_places_updated_at ON public.favorite_places;
CREATE TRIGGER trg_favorite_places_updated_at
BEFORE UPDATE ON public.favorite_places
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_admins_updated_at ON public.admins;
CREATE TRIGGER trg_admins_updated_at
BEFORE UPDATE ON public.admins
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_datasets_updated_at ON public.datasets;
CREATE TRIGGER trg_datasets_updated_at
BEFORE UPDATE ON public.datasets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_road_link_features_updated_at ON public.road_link_features;
CREATE TRIGGER trg_road_link_features_updated_at
BEFORE UPDATE ON public.road_link_features
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_notices_updated_at ON public.notices;
CREATE TRIGGER trg_notices_updated_at
BEFORE UPDATE ON public.notices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inquiries_updated_at ON public.inquiries;
CREATE TRIGGER trg_inquiries_updated_at
BEFORE UPDATE ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 공지 게시시각
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_notice_published_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_published = true AND NEW.published_at IS NULL THEN
        NEW.published_at := now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notices_published_at ON public.notices;
CREATE TRIGGER trg_notices_published_at
BEFORE INSERT OR UPDATE OF is_published, published_at
ON public.notices
FOR EACH ROW EXECUTE FUNCTION public.set_notice_published_at();

-- ============================================================================
-- 경로 선택시각
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_route_candidate_selected_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_selected = true AND NEW.selected_at IS NULL THEN
        NEW.selected_at := now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_candidates_selected_at ON public.route_candidates;
CREATE TRIGGER trg_route_candidates_selected_at
BEFORE INSERT OR UPDATE OF is_selected, selected_at
ON public.route_candidates
FOR EACH ROW EXECUTE FUNCTION public.set_route_candidate_selected_at();

-- ============================================================================
-- 문의 답변완료시각
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_inquiry_answered_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'answered'
       AND NEW.answer_content IS NOT NULL
       AND NEW.answered_at IS NULL THEN
        NEW.answered_at := now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inquiries_answered_at ON public.inquiries;
CREATE TRIGGER trg_inquiries_answered_at
BEFORE INSERT OR UPDATE OF status, answer_content, answered_at
ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.set_inquiry_answered_at();

COMMIT;
