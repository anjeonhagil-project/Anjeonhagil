-- Q4 revisions are independent of Q2/behavior profiles. No serving-model activation.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('anjeon_service_migration'));
ALTER TABLE public.ag_q4_sessions ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1 CHECK(revision>0);
ALTER TABLE public.ag_q4_sessions DROP CONSTRAINT IF EXISTS ag_q4_sessions_user_id_survey_version_key;
CREATE UNIQUE INDEX IF NOT EXISTS ag_q4_revision_unique ON public.ag_q4_sessions(user_id,survey_version,revision);
CREATE TABLE IF NOT EXISTS public.ag_q4_retake_requests (
 user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 survey_version uuid NOT NULL,
 FOREIGN KEY(survey_version,user_id) REFERENCES public.ag_preference_history(survey_version,user_id)
);
ALTER TABLE public.ag_q4_retake_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ag_q4_retake_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ag_q4_retake_requests TO service_role;
CREATE TABLE IF NOT EXISTS public.ag_q4_trial_estimates (
 session_id uuid NOT NULL REFERENCES public.ag_q4_sessions(session_id) ON DELETE CASCADE,
 estimator_version text NOT NULL,
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND (result->'policy'->>'productionEnabled'='false') IS TRUE),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,estimator_version)
);
ALTER TABLE public.ag_q4_trial_estimates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ag_q4_trial_estimates FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.ag_q4_trial_estimates TO service_role;
CREATE OR REPLACE FUNCTION public.ag_q4_trial_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM ag_q4_sessions s WHERE s.session_id=NEW.session_id AND s.completed_at IS NOT NULL
 AND (SELECT count(*) FROM ag_q4_responses r WHERE r.session_id=s.session_id)=jsonb_array_length(s.questions))
 THEN RAISE EXCEPTION 'Q4_COMPLETE_SESSION_REQUIRED'; END IF;
 IF NEW.result->'policy'->>'version' IS DISTINCT FROM NEW.estimator_version THEN RAISE EXCEPTION 'ESTIMATOR_VERSION_MISMATCH'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ag_q4_trial_context ON public.ag_q4_trial_estimates;
CREATE TRIGGER ag_q4_trial_context BEFORE INSERT ON public.ag_q4_trial_estimates FOR EACH ROW EXECUTE FUNCTION public.ag_q4_trial_guard();
DROP TRIGGER IF EXISTS ag_immutable ON public.ag_q4_trial_estimates;
CREATE TRIGGER ag_immutable BEFORE UPDATE ON public.ag_q4_trial_estimates FOR EACH ROW EXECUTE FUNCTION public.ag_no_update();

CREATE OR REPLACE FUNCTION public.ag_restart_q4(p_user uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE sv uuid; latest ag_q4_sessions%ROWTYPE;
BEGIN
 PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
 SELECT survey_version INTO sv FROM ag_preferences WHERE user_id=p_user;
 IF sv IS NULL THEN RAISE EXCEPTION 'SURVEY_REQUIRED'; END IF;
 SELECT * INTO latest FROM ag_q4_sessions WHERE user_id=p_user AND survey_version=sv ORDER BY revision DESC LIMIT 1;
 IF latest.completed_at IS NOT NULL THEN
  INSERT INTO ag_q4_retake_requests(user_id,survey_version) VALUES(p_user,sv)
  ON CONFLICT(user_id) DO UPDATE SET survey_version=excluded.survey_version;
 END IF;
 RETURN sv;
END $$;

CREATE OR REPLACE FUNCTION public.ag_begin_q4(p_user uuid,p_survey uuid,p_case_set text,p_reference text,p_source text,p_questions jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r ag_q4_sessions%ROWTYPE; next_revision integer;
BEGIN
 PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
 IF p_survey IS DISTINCT FROM (SELECT survey_version FROM ag_preferences WHERE user_id=p_user) THEN RAISE EXCEPTION 'STALE_SURVEY'; END IF;
 SELECT * INTO r FROM ag_q4_sessions WHERE user_id=p_user AND survey_version=p_survey ORDER BY revision DESC LIMIT 1;
 IF r.session_id IS NOT NULL AND (r.completed_at IS NULL OR NOT EXISTS(SELECT 1 FROM ag_q4_retake_requests WHERE user_id=p_user AND survey_version=p_survey)) THEN RETURN to_jsonb(r); END IF;
 IF jsonb_typeof(p_questions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_questions)<>4 THEN RAISE EXCEPTION 'FOUR_Q4_QUESTIONS_REQUIRED'; END IF;
 next_revision:=coalesce(r.revision,0)+1;
 INSERT INTO ag_q4_sessions(user_id,survey_version,revision,case_set_version,reference_factor,reference_source,questions)
 VALUES(p_user,p_survey,next_revision,p_case_set,p_reference,p_source,p_questions) RETURNING * INTO r;
 DELETE FROM ag_q4_retake_requests WHERE user_id=p_user;
 RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.ag_answer_q4(p_user uuid,p_session uuid,p_index integer,p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s ag_q4_sessions%ROWTYPE; r ag_q4_responses%ROWTYPE; count_answers integer;
BEGIN
 PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
 SELECT * INTO s FROM ag_q4_sessions WHERE session_id=p_session AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR s.survey_version IS DISTINCT FROM (SELECT survey_version FROM ag_preferences WHERE user_id=p_user)
 OR s.revision<>(SELECT max(revision) FROM ag_q4_sessions WHERE user_id=p_user AND survey_version=s.survey_version)
 THEN RAISE EXCEPTION 'STALE_Q4_SESSION'; END IF;
 IF p_index IS NULL OR p_index<0 OR p_index>=jsonb_array_length(s.questions) OR p_answer IS NULL OR p_answer NOT IN ('A','B','UNSURE') THEN RAISE EXCEPTION 'INVALID_Q4_ANSWER'; END IF;
 IF p_index>(SELECT count(*) FROM ag_q4_responses WHERE session_id=p_session) THEN RAISE EXCEPTION 'Q4_ANSWER_OUT_OF_ORDER'; END IF;
 INSERT INTO ag_q4_responses(session_id,question_index,answer) VALUES(p_session,p_index,p_answer) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM ag_q4_responses WHERE session_id=p_session AND question_index=p_index;
 IF r.answer IS DISTINCT FROM p_answer THEN RAISE EXCEPTION 'Q4_ANSWER_ALREADY_RECORDED'; END IF;
 SELECT count(*) INTO count_answers FROM ag_q4_responses WHERE session_id=p_session;
 IF count_answers=jsonb_array_length(s.questions) AND s.completed_at IS NULL THEN
  UPDATE ag_q4_sessions SET completed_at=now() WHERE session_id=p_session;
  UPDATE users SET onboarding=true WHERE id=p_user;
 END IF;
 RETURN jsonb_build_object('answered',count_answers,'completed',count_answers=jsonb_array_length(s.questions));
END $$;
REVOKE ALL ON FUNCTION ag_restart_q4(uuid),ag_begin_q4(uuid,uuid,text,text,text,jsonb),ag_answer_q4(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ag_restart_q4(uuid),ag_begin_q4(uuid,uuid,text,text,text,jsonb),ag_answer_q4(uuid,uuid,integer,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
