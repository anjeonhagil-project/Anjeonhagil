-- Q4 초기 선호 해석은 실제 선택/행동 가중치와 분리해 불변 저장한다. 과거 응답과 검색은 수정하지 않는다.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('anjeon_service_migration'));
ALTER TABLE public.ag_user_profiles ADD COLUMN IF NOT EXISTS q4_personalization_enabled boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.ag_q4_profiles (
 session_id uuid NOT NULL REFERENCES public.ag_q4_sessions(session_id) ON DELETE CASCADE,
 policy_version text NOT NULL CHECK(length(trim(policy_version))>0),
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 survey_version uuid NOT NULL,
 interpretation jsonb NOT NULL CHECK(jsonb_typeof(interpretation)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,policy_version),
 FOREIGN KEY(survey_version,user_id) REFERENCES public.ag_preference_history(survey_version,user_id)
);
ALTER TABLE public.ag_q4_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ag_q4_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.ag_q4_profiles TO service_role;
CREATE OR REPLACE FUNCTION public.ag_q4_profile_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM ag_q4_sessions s WHERE s.session_id=NEW.session_id AND s.user_id=NEW.user_id
   AND s.survey_version=NEW.survey_version AND s.completed_at IS NOT NULL
   AND (SELECT count(*) FROM ag_q4_responses r WHERE r.session_id=s.session_id)=4)
 THEN RAISE EXCEPTION 'Q4_COMPLETE_SESSION_REQUIRED'; END IF;
 IF NEW.interpretation->>'sessionId' IS DISTINCT FROM NEW.session_id::text
   OR NEW.interpretation->>'surveyVersion' IS DISTINCT FROM NEW.survey_version::text
   OR NEW.interpretation->'policy'->>'version' IS DISTINCT FROM NEW.policy_version
   OR NEW.interpretation->>'source' IS DISTINCT FROM 'ONBOARDING_SURVEY'
 THEN RAISE EXCEPTION 'Q4_PROFILE_CONTEXT_MISMATCH'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ag_q4_profile_context ON public.ag_q4_profiles;
CREATE TRIGGER ag_q4_profile_context BEFORE INSERT ON public.ag_q4_profiles FOR EACH ROW EXECUTE FUNCTION public.ag_q4_profile_guard();
DROP TRIGGER IF EXISTS ag_immutable ON public.ag_q4_profiles;
CREATE TRIGGER ag_immutable BEFORE UPDATE ON public.ag_q4_profiles FOR EACH ROW EXECUTE FUNCTION public.ag_no_update();
-- 명시적 재설문: 과거 응답/프로필은 보존하고 Q2 초기값에서 새 버전을 시작한다. 중복 요청은 현재 미완료 버전을 재사용한다.
CREATE OR REPLACE FUNCTION public.ag_restart_q4(p_user uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old ag_preference_history%ROWTYPE; sv uuid:=gen_random_uuid(); pv uuid:=gen_random_uuid();
BEGIN
 PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
 SELECT h.* INTO old FROM ag_preferences p JOIN ag_preference_history h USING(survey_version) WHERE p.user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'SURVEY_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM ag_q4_sessions WHERE user_id=p_user AND survey_version=old.survey_version AND completed_at IS NOT NULL)
 THEN RETURN old.survey_version; END IF;
 INSERT INTO ag_preference_history(survey_version,user_id,driving_frequency,ranks,survey_weights)
 VALUES(sv,p_user,old.driving_frequency,old.ranks,old.survey_weights);
 INSERT INTO ag_profile_versions(profile_version,user_id,survey_version,effective_weights,model_version,reason)
 VALUES(pv,p_user,sv,old.survey_weights,'survey_only_v1','survey');
 UPDATE ag_preferences SET survey_version=sv,updated_at=now() WHERE user_id=p_user;
 UPDATE ag_user_profiles SET active_profile_version=pv,history_start_at=now(),updated_at=now() WHERE user_id=p_user;
 RETURN sv;
END $$;
REVOKE ALL ON FUNCTION ag_restart_q4(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ag_restart_q4(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.ag_set_q4_enabled(p_user uuid,p_enabled boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'Q4_ENABLED_REQUIRED'; END IF;
 PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
 UPDATE ag_user_profiles SET q4_personalization_enabled=p_enabled WHERE user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_REQUIRED'; END IF;
 RETURN p_enabled;
END $$;
REVOKE ALL ON FUNCTION ag_set_q4_enabled(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ag_set_q4_enabled(uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
