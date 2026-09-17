-- 서비스 통합: Q3 제거, Q4 설문/실제 선택 분리, 추천 응답 보존. 기존 사용자·이력과 동결 데이터 버전은 유지한다.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('anjeon_service_migration'));
ALTER TABLE public.ag_searches ALTER COLUMN max_detour_minutes DROP NOT NULL;
ALTER TABLE public.ag_searches ADD COLUMN IF NOT EXISTS response_snapshot jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.ag_q4_sessions (
 session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 survey_version uuid NOT NULL,
 case_set_version text NOT NULL,
 reference_factor text NOT NULL,
 reference_source text NOT NULL CHECK(reference_source IN ('Q2_TOP','DEFAULT_REFERENCE')),
 questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array' AND jsonb_array_length(questions)=4),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(user_id,survey_version),
 FOREIGN KEY(survey_version,user_id) REFERENCES public.ag_preference_history(survey_version,user_id)
);
CREATE TABLE IF NOT EXISTS public.ag_q4_responses (
 session_id uuid NOT NULL REFERENCES public.ag_q4_sessions(session_id) ON DELETE CASCADE,
 question_index smallint NOT NULL CHECK(question_index BETWEEN 0 AND 3),
 answer text NOT NULL CHECK(answer IN ('A','B','UNSURE')),
 answered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,question_index)
);
ALTER TABLE public.ag_q4_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ag_q4_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ag_q4_sessions,public.ag_q4_responses FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ag_q4_sessions,public.ag_q4_responses TO service_role;
DROP TRIGGER IF EXISTS ag_immutable ON public.ag_q4_responses;
CREATE TRIGGER ag_immutable BEFORE UPDATE ON public.ag_q4_responses FOR EACH ROW EXECUTE FUNCTION public.ag_no_update();
CREATE OR REPLACE FUNCTION public.ag_q4_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF (to_jsonb(NEW)-'completed_at') IS DISTINCT FROM (to_jsonb(OLD)-'completed_at')
    OR (OLD.completed_at IS NOT NULL AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN RAISE EXCEPTION 'Q4_SNAPSHOT_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ag_immutable ON public.ag_q4_sessions;
CREATE TRIGGER ag_immutable BEFORE UPDATE ON public.ag_q4_sessions FOR EACH ROW EXECUTE FUNCTION public.ag_q4_guard();

CREATE OR REPLACE FUNCTION public.ag_save_preferences(p_user uuid,p_frequency text,p_ranks jsonb,p_q3 integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); w jsonb:=ag_survey_weights(p_ranks); old ag_preference_history%ROWTYPE;
BEGIN
 IF p_q3 IS NOT NULL THEN RAISE EXCEPTION 'Q3_REMOVED'; END IF;
 PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
 SELECT h.* INTO old FROM ag_preferences cur JOIN ag_preference_history h USING(survey_version) WHERE cur.user_id=p_user;
 IF old.driving_frequency=p_frequency AND old.ranks=p_ranks AND old.max_detour_minutes IS NULL THEN
   RETURN jsonb_build_object('survey_version',old.survey_version,'profile_version',(SELECT active_profile_version FROM ag_user_profiles WHERE user_id=p_user),'survey_weights',w);
 END IF;
 INSERT INTO ag_preference_history(survey_version,user_id,driving_frequency,ranks,survey_weights) VALUES(s,p_user,p_frequency,p_ranks,w);
 INSERT INTO ag_preferences(user_id,survey_version) VALUES(p_user,s) ON CONFLICT(user_id) DO UPDATE SET survey_version=excluded.survey_version,updated_at=now();
 INSERT INTO ag_profile_versions(profile_version,user_id,survey_version,effective_weights,model_version,reason) VALUES(p,p_user,s,w,'survey_only_v1','survey');
 INSERT INTO ag_user_profiles(user_id,active_profile_version) VALUES(p_user,p) ON CONFLICT(user_id) DO UPDATE SET active_profile_version=excluded.active_profile_version,history_start_at=now(),updated_at=now();
 -- 기존 Q4 완료 사용자는 설정 변경만으로 최초 가입 흐름을 반복하지 않는다.
 UPDATE users SET onboarding=EXISTS(SELECT 1 FROM ag_q4_sessions WHERE user_id=p_user AND completed_at IS NOT NULL) WHERE id=p_user;
 RETURN jsonb_build_object('survey_version',s,'profile_version',p,'survey_weights',w,'effective_weights',w);
END $$;

CREATE OR REPLACE FUNCTION public.ag_begin_q4(p_user uuid,p_survey uuid,p_case_set text,p_reference text,p_source text,p_questions jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r ag_q4_sessions%ROWTYPE;
BEGIN
 PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
 IF p_survey IS DISTINCT FROM (SELECT survey_version FROM ag_preferences WHERE user_id=p_user) THEN RAISE EXCEPTION 'STALE_SURVEY'; END IF;
 INSERT INTO ag_q4_sessions(user_id,survey_version,case_set_version,reference_factor,reference_source,questions)
 VALUES(p_user,p_survey,p_case_set,p_reference,p_source,p_questions) ON CONFLICT(user_id,survey_version) DO NOTHING;
 SELECT * INTO STRICT r FROM ag_q4_sessions WHERE user_id=p_user AND survey_version=p_survey;
 RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.ag_answer_q4(p_user uuid,p_session uuid,p_index integer,p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s ag_q4_sessions%ROWTYPE; r ag_q4_responses%ROWTYPE; count_answers integer;
BEGIN
 PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
 SELECT * INTO s FROM ag_q4_sessions WHERE session_id=p_session AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR s.survey_version IS DISTINCT FROM (SELECT survey_version FROM ag_preferences WHERE user_id=p_user) THEN RAISE EXCEPTION 'STALE_Q4_SESSION'; END IF;
 INSERT INTO ag_q4_responses(session_id,question_index,answer) VALUES(p_session,p_index,p_answer) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM ag_q4_responses WHERE session_id=p_session AND question_index=p_index;
 IF r.answer IS DISTINCT FROM p_answer THEN RAISE EXCEPTION 'Q4_ANSWER_ALREADY_RECORDED'; END IF;
 SELECT count(*) INTO count_answers FROM ag_q4_responses WHERE session_id=p_session;
 IF count_answers=4 AND s.completed_at IS NULL THEN
   UPDATE ag_q4_sessions SET completed_at=now() WHERE session_id=p_session;
   UPDATE users SET onboarding=true WHERE id=p_user;
 END IF;
 RETURN jsonb_build_object('answered',count_answers,'completed',count_answers=4);
END $$;

-- 새 선택은 실제 서비스 검색에서만 받는다. 과거 onboarding 이력은 읽기 전용으로 보존한다.
CREATE OR REPLACE FUNCTION public.ag_record_choice(p_user uuid,p_exposure uuid,p_choice uuid,p_selected uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e ag_exposures%ROWTYPE; r ag_choices%ROWTYPE;
BEGIN
 PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
 SELECT * INTO e FROM ag_exposures WHERE exposure_id=p_exposure AND user_id=p_user;
 IF NOT FOUND OR p_selected IS NULL OR NOT(e.displayed_candidate_ids @> jsonb_build_array(p_selected::text)) THEN RAISE EXCEPTION 'CHOICE_NOT_EXPOSED'; END IF;
 PERFORM 1 FROM ag_searches WHERE search_id=e.search_id AND sample_origin='service' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_CHOICE_ONLY'; END IF;
 INSERT INTO ag_choices(choice_event_id,exposure_id,search_id,user_id,selected_candidate_id) VALUES(p_choice,p_exposure,e.search_id,p_user,p_selected) ON CONFLICT(search_id) DO NOTHING;
 SELECT * INTO STRICT r FROM ag_choices WHERE search_id=e.search_id;
 IF r.selected_candidate_id<>p_selected THEN RAISE EXCEPTION 'CHOICE_ALREADY_RECORDED'; END IF;
 RETURN to_jsonb(r);
END $$;

-- ag_save_search와 실제 모델 등록은 아래에 고정된 산출물 값으로 정의한다.
CREATE OR REPLACE FUNCTION public.ag_save_search(p_user uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s jsonb:=p_payload->'search'; c jsonb; seg jsonb; rel ag_dataset_releases%ROWTYPE; prof ag_profile_versions%ROWTYPE; mdl ag_model_versions%ROWTYPE;
  sid uuid; ver jsonb; candidates jsonb:=p_payload->'candidates'; snap jsonb; minimum float8; seconds float8; lo numeric; hi numeric;
BEGIN
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR jsonb_typeof(candidates) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SEARCH_AND_CANDIDATES_REQUIRED'; END IF;
  IF jsonb_array_length(candidates) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'CANDIDATES_REQUIRED'; END IF;
  PERFORM 1 FROM users WHERE id=p_user AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
  SELECT r.* INTO rel FROM ag_dataset_active a JOIN ag_dataset_releases r USING(release_id) WHERE a.singleton AND r.status='ready';
  IF NOT FOUND OR rel.release_id IS DISTINCT FROM s->>'release_id' THEN RAISE EXCEPTION 'ACTIVE_DATASET_MISMATCH'; END IF;
  ver:=jsonb_build_object('dataset_version',rel.dataset_version,'contract_version',rel.contract_version,'feature_version',rel.feature_version,'eta_version',rel.eta_version,'routing_policy_version',rel.routing_policy_version);
  IF ver IS DISTINCT FROM s->'versions' THEN RAISE EXCEPTION 'CALCULATION_VERSION_MISMATCH'; END IF;
  SELECT * INTO prof FROM ag_profile_versions WHERE profile_version=(s->>'profile_version')::uuid AND user_id=p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_OWNERSHIP_MISMATCH'; END IF;
  snap:=jsonb_build_object('profile_version',prof.profile_version,'survey_version',prof.survey_version,'effective_weights',prof.effective_weights);
  IF s->'profile_snapshot' IS DISTINCT FROM snap THEN RAISE EXCEPTION 'PROFILE_SNAPSHOT_MISMATCH'; END IF;
  SELECT * INTO mdl FROM ag_model_versions WHERE model_version=s->>'model_version';
  IF NOT FOUND OR mdl.feature_version<>rel.feature_version OR mdl.contract_version<>rel.contract_version OR mdl.eta_version<>rel.eta_version
    OR (prof.reason='learned' AND prof.model_version<>mdl.model_version) THEN RAISE EXCEPTION 'MODEL_VERSION_MISMATCH'; END IF;
  IF s->>'departure_at' IS NULL OR s->>'departure_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'TIMEZONE_REQUIRED'; END IF;
  IF coalesce(s->>'sample_origin','service')<>'service' THEN RAISE EXCEPTION 'SERVICE_SEARCH_ONLY'; END IF;
  IF s->>'max_detour_minutes' IS NOT NULL THEN RAISE EXCEPTION 'Q3_REMOVED'; END IF;
  IF s->>'sample_origin'='onboarding' THEN
    PERFORM 1 FROM ag_onboarding_progress o WHERE o.user_id=p_user AND o.completed_at IS NULL AND o.survey_version=prof.survey_version
      AND o.survey_version=(SELECT survey_version FROM ag_preferences WHERE user_id=p_user)
      AND o.case_set_version=s->>'onboarding_case_set_version' AND o.required_case_ids @> jsonb_build_array(s->>'onboarding_case_id');
    IF NOT FOUND THEN RAISE EXCEPTION 'ONBOARDING_CASE_MISMATCH'; END IF;
  ELSIF s->>'onboarding_case_id' IS NOT NULL OR s->>'onboarding_case_set_version' IS NOT NULL THEN RAISE EXCEPTION 'ONBOARDING_CONTEXT_NOT_ALLOWED'; END IF;
  sid:=(s->>'search_id')::uuid; minimum:=(s->>'minimum_internal_duration_s')::float8;
  INSERT INTO ag_searches(search_id,user_id,release_id,profile_version,model_version,departure_at,origin,destination,max_detour_minutes,minimum_internal_duration_s,profile_snapshot,versions,sample_origin,onboarding_case_set_version,onboarding_case_id,response_snapshot)
    VALUES(sid,p_user,rel.release_id,prof.profile_version,mdl.model_version,(s->>'departure_at')::timestamptz,s->'origin',s->'destination',(s->>'max_detour_minutes')::smallint,minimum,snap,ver,coalesce(s->>'sample_origin','service'),s->>'onboarding_case_set_version',s->>'onboarding_case_id',p_payload->'response');
  FOR c IN SELECT value FROM jsonb_array_elements(candidates) LOOP
    IF c->>'search_id' IS DISTINCT FROM sid::text OR c->>'user_id' IS DISTINCT FROM p_user::text OR c->>'release_id' IS DISTINCT FROM rel.release_id THEN RAISE EXCEPTION 'CANDIDATE_CONTEXT_MISMATCH'; END IF;
    IF NOT (c @> ver) OR c->>'profile_version' IS DISTINCT FROM prof.profile_version::text OR c->'profile_weights' IS DISTINCT FROM prof.effective_weights OR c->>'model_version' IS DISTINCT FROM mdl.model_version
       OR c->>'departure_at' IS DISTINCT FROM s->>'departure_at' THEN RAISE EXCEPTION 'CANDIDATE_VERSION_OR_PROFILE_MISMATCH'; END IF;
    IF c->'factor_order' IS DISTINCT FROM '["COMPLEX_INTERSECTION","MERGE_BRANCH","NARROW_ROAD","UNFAMILIAR_TURN","CONSECUTIVE_ACTION","CHILD_ZONE_NEARBY"]'::jsonb
       OR c->'units' IS DISTINCT FROM '["count","score*m","score*m","count","count","m"]'::jsonb THEN RAISE EXCEPTION 'FEATURE_SCHEMA_MISMATCH'; END IF;
    seconds:=(c->>'internal_duration_s')::float8;
    IF seconds<minimum-0.00001 THEN RAISE EXCEPTION 'INVALID_MINIMUM'; END IF;
    IF (c->>'display_duration_s')::numeric IS DISTINCT FROM floor(seconds::numeric/60+0.5)*60 THEN RAISE EXCEPTION 'DISPLAY_TIME_MISMATCH'; END IF;
    IF NOT ag_valid_vector(c->'raw_features',6) OR jsonb_typeof(c->'quality'->'child_circle_inside_m') IS DISTINCT FROM 'number'
       OR abs((c->'raw_features'->>5)::numeric-(c->'quality'->>'child_circle_inside_m')::numeric)>0.001
       OR (c->'raw_features'->>5)::numeric>(c->>'distance_m')::numeric+0.001 THEN RAISE EXCEPTION 'INVALID_RAW6_OR_CHILD_QUALITY'; END IF;
    IF jsonb_typeof(c->'segments') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'segments')=0 THEN RAISE EXCEPTION 'SEGMENTS_REQUIRED'; END IF;
    FOR seg IN SELECT value FROM jsonb_array_elements(c->'segments') LOOP
      IF jsonb_typeof(seg->'arc_id') IS DISTINCT FROM 'number' OR seg->>'arc_id'!~'^[0-9]+$'
         OR jsonb_typeof(seg->'start_fraction') IS DISTINCT FROM 'number' OR jsonb_typeof(seg->'end_fraction') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'INVALID_SEGMENT'; END IF;
      lo:=(seg->>'start_fraction')::numeric; hi:=(seg->>'end_fraction')::numeric;
      IF NOT(0<=lo AND lo<hi AND hi<=1) THEN RAISE EXCEPTION 'INVALID_FRACTIONS'; END IF;
    END LOOP;
    INSERT INTO ag_candidates(candidate_id,search_id,route_types,segments,distance_m,internal_duration_s,display_duration_s,display_duration_source,raw6,geometry_geojson,hourly_coverage,quality,snapshot)
      VALUES((c->>'candidate_id')::uuid,sid,c->'route_types',c->'segments',(c->>'distance_m')::float8,seconds,(c->>'display_duration_s')::integer,c->>'display_duration_source',c->'raw_features',c->'geometry',c->'hourly_speed_coverage',c->'quality',c);
  END LOOP;
  RETURN sid;
END $$;


INSERT INTO ag_model_versions(model_version,model_type,contract_version,feature_version,eta_version,scale_version,scaler,artifact_path,artifact_sha256,training_manifest_sha256,metrics)
VALUES('logistic_synthetic_20260916','logistic','anjeon_contract_v6_child100','static_burden_v5_child_circle_inside','internal_hourly_topis_v1','train_standard_deviation_20260916','{"values":[301.15912372353347,987.9406774299155,0.4458973514638569,287.3607866115419,173.01840149943624,0.3482699274977062,0.8600035396574081,84.01488742897423],"fit_split":"train","feature_version":"static_burden_v5_child_circle_inside","scale_version":"train_standard_deviation_20260916","fit_manifest_sha256":"9717c49758d0466a917d6bd3fc893d95825c9b7e12f2974938e7d62c0b9ebdca"}'::jsonb,'ml/bundled/logistic.json','df480f0a971bd313af22a73dfed0d85dadb0d59da78bb687bbac10ef4e9db89e','9717c49758d0466a917d6bd3fc893d95825c9b7e12f2974938e7d62c0b9ebdca','{"training_source":"SYNTHETIC_TEAM_DATA","real_user_validated":false,"test":{"rows":900,"searches":450,"pair_accuracy":0.8822222222222222,"roc_auc":0.9573522439949431,"log_loss":0.2704669479855462,"top1_accuracy":0.8,"top1_hits":360,"top1_searches":450}}'::jsonb) ON CONFLICT(model_version) DO NOTHING;
UPDATE ag_model_versions SET is_active=false WHERE is_active AND model_version<>'logistic_synthetic_20260916';
UPDATE ag_model_versions SET is_active=true WHERE model_version='logistic_synthetic_20260916';
REVOKE ALL ON FUNCTION ag_begin_q4(uuid,uuid,text,text,text,jsonb),ag_answer_q4(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ag_begin_q4(uuid,uuid,text,text,text,jsonb),ag_answer_q4(uuid,uuid,integer,text) TO service_role;
CREATE TABLE IF NOT EXISTS public.ag_route_failures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
 search_id uuid NOT NULL,
 error_code text NOT NULL,
 duration_ms integer NOT NULL CHECK(duration_ms>=0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ag_failures_created ON public.ag_route_failures(created_at DESC);
ALTER TABLE public.ag_route_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ag_route_failures FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ag_route_failures TO service_role;
CREATE OR REPLACE VIEW public.ag_choice_training_events WITH (security_invoker=true) AS
SELECT ch.*,s.sample_origin,e.displayed_candidate_ids,e.exposed_at,s.departure_at,s.profile_snapshot,s.versions,
       s.profile_snapshot->'effective_weights' AS profile_weights,
       (SELECT jsonb_agg(c.snapshot ORDER BY j.ord) FROM jsonb_array_elements_text(e.displayed_candidate_ids) WITH ORDINALITY j(id,ord)
        JOIN ag_candidates c ON c.candidate_id=j.id::uuid AND c.search_id=s.search_id) AS snapshots,
       COALESCE(to_jsonb(e)->'context','{"policy":"legacy_rendered_v1"}'::jsonb) AS exposure_context,
       s.response_snapshot->>'recommendedCandidateId' AS original_recommended_candidate_id
FROM ag_choices ch JOIN ag_exposures e USING(exposure_id) JOIN ag_searches s ON s.search_id=ch.search_id
WHERE ch.event_source='ACTUAL_USER_CHOICE' AND s.sample_origin='service';
REVOKE ALL ON public.ag_choice_training_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ag_choice_training_events TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
