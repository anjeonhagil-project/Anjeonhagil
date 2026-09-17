-- 기능(Anjeonhagil): 기존 baseline을 유지하며 설문·Q4 완료·개인화·경로·학습 내보내기의 저장 기반을 한 번에 추가한다. 원격 사전 점검 후 적용한다.
-- 기능: baseline 이후 Anjeonhagil 설문·개인화·경로 snapshot 저장 기반을 한 트랜잭션으로 추가한다. 2026-09-16 원격 적용·검증 완료; 실행 도구는 database/manage.py이다.
-- 도로망은 apps/backend/routing/data의 읽기 전용 SQLite에서 계산한다. 첨부 ag_* 전체 적재 SQL과 병용하지 않는다.
-- 기존 22개 테이블/데이터는 유지한다. 모든 신규 데이터 접근은 인증된 Express의 service_role을 통해서만 수행한다.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = public, pg_temp;
SELECT pg_advisory_xact_lock(20260916, 100);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='id' AND udt_name='uuid')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='onboarding' AND udt_name='bool') THEN
    RAISE EXCEPTION 'BASELINE_REQUIRED: public.users(id uuid, onboarding boolean)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ag\_%' ESCAPE '\')
     AND (to_regclass('public.ag_dataset_releases') IS NULL OR obj_description(to_regclass('public.ag_dataset_releases'),'pg_class') IS DISTINCT FROM 'CHILD100_FOUNDATION_SQLITE_V1') THEN
    RAISE EXCEPTION 'INCOMPATIBLE_AG_SCHEMA: 첨부본 full-mirror SQL 또는 알 수 없는 ag_ 구조와 혼용할 수 없습니다';
  END IF;
END $$;

-- NULL·문자열·boolean·음수·잘못된 길이를 CHECK에서 우회하지 못하게 하는 공통 검사.
CREATE OR REPLACE FUNCTION public.ag_valid_vector(v jsonb, n integer, expected_sum numeric DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE x jsonb; total numeric:=0;
BEGIN
  IF v IS NULL OR jsonb_typeof(v)<>'array' OR jsonb_array_length(v)<>n THEN RETURN false; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(v) LOOP
    IF jsonb_typeof(x)<>'number' OR x::text::numeric<0 THEN RETURN false; END IF;
    total:=total+x::text::numeric;
  END LOOP;
  RETURN expected_sum IS NULL OR abs(total-expected_sum)<0.000000001;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.ag_survey_weights(ranks jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE x jsonb; r integer; k integer; vals integer[]:='{}'; weights jsonb:='[]';
BEGIN
  IF ranks IS NULL OR jsonb_typeof(ranks)<>'array' OR jsonb_array_length(ranks)<>6 THEN RAISE EXCEPTION 'SIX_RANKS_REQUIRED'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(ranks) LOOP
    IF jsonb_typeof(x)<>'number' OR x::text!~'^[0-6]$' THEN RAISE EXCEPTION 'INTEGER_RANK_REQUIRED'; END IF;
    vals:=array_append(vals,x::text::integer);
  END LOOP;
  SELECT count(*) INTO k FROM unnest(vals) AS item(value) WHERE item.value>0;
  IF (SELECT count(DISTINCT item.value) FROM unnest(vals) AS item(value) WHERE item.value>0)<>k OR (SELECT max(item.value) FROM unnest(vals) AS item(value))<>k THEN RAISE EXCEPTION 'RANKS_MUST_BE_CONTIGUOUS'; END IF;
  FOREACH r IN ARRAY vals LOOP
    weights:=weights||jsonb_build_array(CASE WHEN r=0 THEN 0::double precision ELSE (k-r+1)::double precision/(k*(k+1)/2.0)::double precision END);
  END LOOP;
  RETURN weights;
END $$;

CREATE TABLE IF NOT EXISTS public.ag_dataset_releases (
  release_id text PRIMARY KEY,
  dataset_version text NOT NULL, contract_version text NOT NULL, feature_version text NOT NULL,
  eta_version text NOT NULL, routing_policy_version text NOT NULL,
  storage_mode text NOT NULL DEFAULT 'sqlite' CHECK(storage_mode='sqlite'),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  status text NOT NULL DEFAULT 'staging' CHECK(status IN ('staging','ready')),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ag_dataset_releases IS 'CHILD100_FOUNDATION_SQLITE_V1';
CREATE TABLE IF NOT EXISTS public.ag_dataset_active (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  release_id text NOT NULL REFERENCES public.ag_dataset_releases(release_id),
  activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ag_model_versions (
  model_version text PRIMARY KEY,
  model_type text NOT NULL CHECK(model_type IN ('survey','logistic','xgboost')),
  contract_version text NOT NULL, feature_version text NOT NULL, eta_version text NOT NULL,
  scale_version text, scaler jsonb, artifact_path text, artifact_sha256 text,
  training_manifest_sha256 text, metrics jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(model_type='survey' OR (scale_version IS NOT NULL AND scaler IS NOT NULL
    AND jsonb_typeof(scaler)='object' AND (scaler->>'fit_split') IS NOT DISTINCT FROM 'train'
    AND (scaler->>'feature_version') IS NOT DISTINCT FROM feature_version
    AND (scaler->>'scale_version') IS NOT DISTINCT FROM scale_version
    AND ag_valid_vector(scaler->'values',8)
    AND NOT (scaler->'values' @> '[0]'::jsonb)
    AND artifact_path IS NOT NULL AND artifact_sha256 IS NOT NULL AND artifact_sha256 ~ '^[0-9a-f]{64}$'
    AND training_manifest_sha256 IS NOT NULL AND training_manifest_sha256 ~ '^[0-9a-f]{64}$'
    AND (scaler->>'fit_manifest_sha256') IS NOT DISTINCT FROM training_manifest_sha256))
);
CREATE UNIQUE INDEX IF NOT EXISTS ag_one_active_model ON public.ag_model_versions(is_active) WHERE is_active;

CREATE OR REPLACE FUNCTION public.ag_version_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF (TG_TABLE_NAME='ag_model_versions' AND (to_jsonb(NEW)-'is_active') IS DISTINCT FROM (to_jsonb(OLD)-'is_active'))
     OR (TG_TABLE_NAME='ag_dataset_releases' AND (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status')) THEN
    RAISE EXCEPTION 'VERSION_CONTENT_IMMUTABLE: 새 버전으로 등록하세요';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ag_version_immutable ON public.ag_model_versions;
CREATE TRIGGER ag_version_immutable BEFORE UPDATE ON public.ag_model_versions FOR EACH ROW EXECUTE FUNCTION public.ag_version_guard();
DROP TRIGGER IF EXISTS ag_version_immutable ON public.ag_dataset_releases;
CREATE TRIGGER ag_version_immutable BEFORE UPDATE ON public.ag_dataset_releases FOR EACH ROW EXECUTE FUNCTION public.ag_version_guard();

CREATE OR REPLACE FUNCTION public.ag_active_release_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM ag_dataset_releases WHERE release_id=NEW.release_id AND status='ready') THEN RAISE EXCEPTION 'READY_RELEASE_REQUIRED'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ag_active_release_ready ON public.ag_dataset_active;
CREATE TRIGGER ag_active_release_ready BEFORE INSERT OR UPDATE ON public.ag_dataset_active FOR EACH ROW EXECUTE FUNCTION public.ag_active_release_guard();

-- survey_version은 원본 설문 버전이고 profile_version은 실제 적용 가중치 버전이다.
CREATE TABLE IF NOT EXISTS public.ag_preference_history (
  survey_version uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  driving_frequency text NOT NULL CHECK(driving_frequency IN ('daily','weekly','monthly','rarely','never')),
  ranks jsonb NOT NULL, survey_weights jsonb NOT NULL,
  max_detour_minutes smallint CHECK(max_detour_minutes IN (0,5,10,15)),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(survey_version,user_id),
  CHECK(survey_weights=ag_survey_weights(ranks))
);
CREATE TABLE IF NOT EXISTS public.ag_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  survey_version uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(survey_version,user_id) REFERENCES public.ag_preference_history(survey_version,user_id)
);
CREATE TABLE IF NOT EXISTS public.ag_profile_versions (
  profile_version uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  survey_version uuid NOT NULL,
  effective_weights jsonb NOT NULL CHECK(ag_valid_vector(effective_weights,6,1) OR ag_valid_vector(effective_weights,6,0)),
  model_version text NOT NULL REFERENCES public.ag_model_versions(model_version),
  reason text NOT NULL CHECK(reason IN ('survey','learned','reset','disabled','enabled','model_fallback')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(profile_version,user_id),
  FOREIGN KEY(survey_version,user_id) REFERENCES public.ag_preference_history(survey_version,user_id)
);
CREATE TABLE IF NOT EXISTS public.ag_user_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  active_profile_version uuid NOT NULL,
  personalization_enabled boolean NOT NULL DEFAULT true,
  history_start_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(active_profile_version,user_id) REFERENCES public.ag_profile_versions(profile_version,user_id)
);
CREATE TABLE IF NOT EXISTS public.ag_profile_update_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  input_profile_version uuid NOT NULL, model_version text NOT NULL REFERENCES public.ag_model_versions(model_version),
  history_cutoff timestamptz NOT NULL, sample_search_count integer NOT NULL DEFAULT 0 CHECK(sample_search_count>=0),
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','accepted','held','failed')),
  before_loss double precision CHECK(before_loss>=0 AND before_loss<'Infinity'::float8),
  after_loss double precision CHECK(after_loss>=0 AND after_loss<'Infinity'::float8),
  result_profile_version uuid, reason text, evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  FOREIGN KEY(input_profile_version,user_id) REFERENCES public.ag_profile_versions(profile_version,user_id),
  FOREIGN KEY(result_profile_version,user_id) REFERENCES public.ag_profile_versions(profile_version,user_id),
  UNIQUE(user_id,input_profile_version,model_version,history_cutoff),
  CHECK(status<>'accepted' OR (result_profile_version IS NOT NULL AND before_loss IS NOT NULL AND after_loss IS NOT NULL AND after_loss<before_loss)),
  CHECK(status IN ('queued','running') OR (reason IS NOT NULL AND finished_at IS NOT NULL))
);

-- Q4 설정/완료의 단일 기준. 완료 뒤 설정 화면에서 설문을 바꿔도 최초 온보딩을 반복하지 않는다.
CREATE TABLE IF NOT EXISTS public.ag_onboarding_progress (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  survey_version uuid NOT NULL,
  case_set_version text NOT NULL CHECK(length(trim(case_set_version))>0),
  required_case_ids jsonb NOT NULL CHECK(jsonb_typeof(required_case_ids)='array' AND jsonb_array_length(required_case_ids) BETWEEN 2 AND 3),
  completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(survey_version,user_id) REFERENCES public.ag_preference_history(survey_version,user_id)
);

CREATE TABLE IF NOT EXISTS public.ag_searches (
  search_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  release_id text NOT NULL REFERENCES public.ag_dataset_releases(release_id),
  profile_version uuid NOT NULL, model_version text NOT NULL REFERENCES public.ag_model_versions(model_version),
  departure_at timestamptz NOT NULL,
  origin jsonb NOT NULL CHECK(jsonb_typeof(origin)='object'),
  destination jsonb NOT NULL CHECK(jsonb_typeof(destination)='object'),
  max_detour_minutes smallint NOT NULL CHECK(max_detour_minutes IN (0,5,10,15)),
  minimum_internal_duration_s double precision NOT NULL CHECK(minimum_internal_duration_s>0 AND minimum_internal_duration_s<'Infinity'::float8),
  profile_snapshot jsonb NOT NULL CHECK(jsonb_typeof(profile_snapshot)='object'),
  versions jsonb NOT NULL CHECK(jsonb_typeof(versions)='object'),
  sample_origin text NOT NULL DEFAULT 'service' CHECK(sample_origin IN ('service','onboarding','study')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(search_id,user_id),
  FOREIGN KEY(profile_version,user_id) REFERENCES public.ag_profile_versions(profile_version,user_id)
);
-- 앞선 준비 SQL이 적용돼 있어도 기존 검색은 보존하고 사례 연결 컬럼만 추가한다.
ALTER TABLE public.ag_searches ADD COLUMN IF NOT EXISTS onboarding_case_set_version text;
ALTER TABLE public.ag_searches ADD COLUMN IF NOT EXISTS onboarding_case_id text;
CREATE INDEX IF NOT EXISTS ag_onboarding_searches ON public.ag_searches(user_id,onboarding_case_set_version,onboarding_case_id) WHERE sample_origin='onboarding';

CREATE TABLE IF NOT EXISTS public.ag_candidates (
  candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid NOT NULL REFERENCES public.ag_searches(search_id) ON DELETE CASCADE,
  route_types jsonb NOT NULL CHECK(jsonb_typeof(route_types)='array' AND jsonb_array_length(route_types)>0),
  segments jsonb NOT NULL CHECK(jsonb_typeof(segments)='array' AND jsonb_array_length(segments)>0),
  distance_m double precision NOT NULL CHECK(distance_m>0 AND distance_m<'Infinity'::float8),
  internal_duration_s double precision NOT NULL CHECK(internal_duration_s>0 AND internal_duration_s<'Infinity'::float8),
  display_duration_s integer NOT NULL CHECK(display_duration_s>=0 AND display_duration_s%60=0),
  display_duration_source text NOT NULL CHECK(display_duration_source='INTERNAL_HOURLY'),
  raw6 jsonb NOT NULL CHECK(ag_valid_vector(raw6,6)),
  geometry_geojson jsonb NOT NULL CHECK(jsonb_typeof(geometry_geojson)='object' AND (geometry_geojson->>'type') IS NOT DISTINCT FROM 'LineString'),
  hourly_coverage jsonb NOT NULL CHECK(jsonb_typeof(hourly_coverage)='object'),
  quality jsonb NOT NULL CHECK(jsonb_typeof(quality)='object'),
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
  UNIQUE(candidate_id,search_id)
);
CREATE TABLE IF NOT EXISTS public.ag_exposures (
  exposure_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), search_id uuid NOT NULL, user_id uuid NOT NULL,
  displayed_candidate_ids jsonb NOT NULL CHECK(jsonb_typeof(displayed_candidate_ids)='array' AND jsonb_array_length(displayed_candidate_ids)>0),
  recommended_candidate_id uuid, exposed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exposure_id,search_id,user_id),
  FOREIGN KEY(search_id,user_id) REFERENCES public.ag_searches(search_id,user_id) ON DELETE CASCADE,
  FOREIGN KEY(recommended_candidate_id,search_id) REFERENCES public.ag_candidates(candidate_id,search_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS public.ag_choices (
  choice_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exposure_id uuid NOT NULL, search_id uuid NOT NULL UNIQUE, user_id uuid NOT NULL,
  selected_candidate_id uuid NOT NULL, chosen_at timestamptz NOT NULL DEFAULT now(),
  event_source text NOT NULL DEFAULT 'ACTUAL_USER_CHOICE' CHECK(event_source='ACTUAL_USER_CHOICE'),
  FOREIGN KEY(exposure_id,search_id,user_id) REFERENCES public.ag_exposures(exposure_id,search_id,user_id) ON DELETE CASCADE,
  FOREIGN KEY(selected_candidate_id,search_id) REFERENCES public.ag_candidates(candidate_id,search_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS ag_searches_user_time ON public.ag_searches(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ag_candidates_search ON public.ag_candidates(search_id);
CREATE INDEX IF NOT EXISTS ag_exposures_search ON public.ag_exposures(search_id);
CREATE INDEX IF NOT EXISTS ag_choices_user_time ON public.ag_choices(user_id,chosen_at DESC);
CREATE INDEX IF NOT EXISTS ag_jobs_pending ON public.ag_profile_update_jobs(created_at) WHERE status IN ('queued','running');

CREATE OR REPLACE FUNCTION public.ag_no_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_SNAPSHOT: %',TG_TABLE_NAME; END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ag_preference_history','ag_profile_versions','ag_searches','ag_candidates','ag_exposures','ag_choices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ag_immutable ON public.%I',t);
    EXECUTE format('CREATE TRIGGER ag_immutable BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ag_no_update()',t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ag_check_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s ag_preference_history%ROWTYPE; i integer;
BEGIN
  SELECT * INTO STRICT s FROM ag_preference_history WHERE survey_version=NEW.survey_version AND user_id=NEW.user_id;
  FOR i IN 0..5 LOOP
    IF (s.ranks->>i)::integer=0 AND (NEW.effective_weights->>i)::numeric<>0 THEN RAISE EXCEPTION 'INDIFFERENT_WEIGHT_MUST_BE_ZERO'; END IF;
  END LOOP;
  IF ag_valid_vector(s.survey_weights,6,0) IS DISTINCT FROM ag_valid_vector(NEW.effective_weights,6,0) THEN RAISE EXCEPTION 'PROFILE_WEIGHT_SUM_MISMATCH'; END IF;
  IF NEW.reason<>'learned' AND NEW.effective_weights<>s.survey_weights THEN RAISE EXCEPTION 'SURVEY_FALLBACK_WEIGHTS_REQUIRED'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ag_profile_guard ON public.ag_profile_versions;
CREATE TRIGGER ag_profile_guard BEFORE INSERT ON public.ag_profile_versions FOR EACH ROW EXECUTE FUNCTION public.ag_check_profile();

CREATE OR REPLACE FUNCTION public.ag_save_preferences(p_user uuid,p_frequency text,p_ranks jsonb,p_q3 integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); w jsonb:=ag_survey_weights(p_ranks);
BEGIN
  PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
  INSERT INTO ag_preference_history(survey_version,user_id,driving_frequency,ranks,survey_weights,max_detour_minutes) VALUES(s,p_user,p_frequency,p_ranks,w,p_q3);
  INSERT INTO ag_preferences(user_id,survey_version) VALUES(p_user,s) ON CONFLICT(user_id) DO UPDATE SET survey_version=excluded.survey_version,updated_at=now();
  INSERT INTO ag_profile_versions(profile_version,user_id,survey_version,effective_weights,model_version,reason) VALUES(p,p_user,s,w,'survey_only_v1','survey');
  INSERT INTO ag_user_profiles(user_id,active_profile_version) VALUES(p_user,p)
    ON CONFLICT(user_id) DO UPDATE SET active_profile_version=excluded.active_profile_version,history_start_at=now(),updated_at=now();
  UPDATE users SET onboarding=EXISTS(SELECT 1 FROM ag_onboarding_progress WHERE user_id=p_user AND completed_at IS NOT NULL) WHERE id=p_user;
  RETURN jsonb_build_object('survey_version',s,'profile_version',p,'survey_weights',w,'effective_weights',w);
END $$;

-- 사례 ID는 서버 설정에서 전달한다. 원본 피처/선택 정답을 프론트에서 받지 않는다.
CREATE OR REPLACE FUNCTION public.ag_start_onboarding(p_user uuid,p_case_set text,p_cases jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE sv uuid; r ag_onboarding_progress%ROWTYPE;
BEGIN
  PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
  SELECT survey_version INTO sv FROM ag_preferences WHERE user_id=p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'NEW_SURVEY_REQUIRED'; END IF;
  SELECT * INTO r FROM ag_onboarding_progress WHERE user_id=p_user;
  IF r.completed_at IS NOT NULL THEN RETURN to_jsonb(r); END IF;
  IF p_case_set IS NULL OR length(trim(p_case_set))=0 OR p_cases IS NULL OR jsonb_typeof(p_cases)<>'array' THEN RAISE EXCEPTION 'INVALID_ONBOARDING_CASES'; END IF;
  IF jsonb_array_length(p_cases) NOT BETWEEN 2 AND 3 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_cases) v WHERE jsonb_typeof(v)<>'string' OR length(trim(v#>>'{}'))=0)
     OR (SELECT count(DISTINCT v) FROM jsonb_array_elements_text(p_cases) v)<>jsonb_array_length(p_cases) THEN RAISE EXCEPTION 'INVALID_ONBOARDING_CASES'; END IF;
  IF r.user_id IS NOT NULL AND r.survey_version=sv THEN
    IF r.case_set_version<>p_case_set OR r.required_case_ids<>p_cases THEN RAISE EXCEPTION 'ONBOARDING_CASE_SET_LOCKED'; END IF;
    RETURN to_jsonb(r);
  END IF;
  INSERT INTO ag_onboarding_progress(user_id,survey_version,case_set_version,required_case_ids) VALUES(p_user,sv,p_case_set,p_cases)
    ON CONFLICT(user_id) DO UPDATE SET survey_version=excluded.survey_version,case_set_version=excluded.case_set_version,required_case_ids=excluded.required_case_ids,completed_at=NULL,created_at=now()
    RETURNING * INTO r;
  UPDATE users SET onboarding=false WHERE id=p_user;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.ag_reset_profile(p_user uuid,p_enabled boolean DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s ag_preference_history%ROWTYPE; v uuid:=gen_random_uuid(); mode text;
BEGIN
  PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
  SELECT h.* INTO s FROM ag_preferences p JOIN ag_preference_history h USING(survey_version) WHERE p.user_id=p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'NEW_SURVEY_REQUIRED'; END IF;
  mode:=CASE WHEN p_enabled IS NULL THEN 'reset' WHEN p_enabled THEN 'enabled' ELSE 'disabled' END;
  INSERT INTO ag_profile_versions(profile_version,user_id,survey_version,effective_weights,model_version,reason) VALUES(v,p_user,s.survey_version,s.survey_weights,'survey_only_v1',mode);
  UPDATE ag_user_profiles SET active_profile_version=v,personalization_enabled=coalesce(p_enabled,personalization_enabled),history_start_at=now(),updated_at=now() WHERE user_id=p_user;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.ag_apply_profile_update(p_job uuid,p_weights jsonb,p_before double precision,p_after double precision,p_evidence jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j ag_profile_update_jobs%ROWTYPE; u ag_user_profiles%ROWTYPE; old ag_profile_versions%ROWTYPE; m ag_model_versions%ROWTYPE; v uuid:=gen_random_uuid();
BEGIN
  SELECT * INTO j FROM ag_profile_update_jobs WHERE job_id=p_job;
  IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
  PERFORM 1 FROM users WHERE id=j.user_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
  SELECT * INTO j FROM ag_profile_update_jobs WHERE job_id=p_job FOR UPDATE;
  IF j.status='accepted' THEN RETURN j.result_profile_version; END IF;
  IF j.status NOT IN ('queued','running') THEN RAISE EXCEPTION 'JOB_ALREADY_FINISHED'; END IF;
  SELECT * INTO STRICT u FROM ag_user_profiles WHERE user_id=j.user_id FOR UPDATE;
  SELECT * INTO STRICT old FROM ag_profile_versions WHERE profile_version=j.input_profile_version;
  SELECT * INTO STRICT m FROM ag_model_versions WHERE model_version=j.model_version;
  IF NOT u.personalization_enabled OR u.active_profile_version<>j.input_profile_version OR j.history_cutoff<u.history_start_at
     OR NOT m.is_active OR m.model_type='survey'
     OR m.feature_version<>'static_burden_v5_child_circle_inside' OR m.contract_version<>'anjeon_contract_v6_child100' OR m.eta_version<>'internal_hourly_topis_v1'
     OR old.survey_version IS DISTINCT FROM (SELECT survey_version FROM ag_preferences WHERE user_id=j.user_id) THEN
    UPDATE ag_profile_update_jobs SET status='held',reason='STALE_PROFILE_OR_MODEL_OR_DISABLED',finished_at=now() WHERE job_id=p_job; RETURN NULL;
  END IF;
  IF p_before IS NULL OR p_after IS NULL OR NOT (p_before>=0 AND p_before<'Infinity'::float8 AND p_after>=0 AND p_after<p_before) THEN
    UPDATE ag_profile_update_jobs SET status='held',reason='NO_VALID_IMPROVEMENT',finished_at=now() WHERE job_id=p_job; RETURN NULL;
  END IF;
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence)<>'object' OR j.sample_search_count<1 THEN RAISE EXCEPTION 'UPDATE_EVIDENCE_REQUIRED'; END IF;
  INSERT INTO ag_profile_versions(profile_version,user_id,survey_version,effective_weights,model_version,reason) VALUES(v,j.user_id,old.survey_version,p_weights,j.model_version,'learned');
  UPDATE ag_user_profiles SET active_profile_version=v,updated_at=now() WHERE user_id=j.user_id;
  UPDATE ag_profile_update_jobs SET status='accepted',result_profile_version=v,before_loss=p_before,after_loss=p_after,evidence=p_evidence,reason='VALIDATION_IMPROVED',finished_at=now() WHERE job_id=p_job;
  RETURN v;
END $$;

-- 검색·후보는 서비스가 검증된 worker 응답을 변환해 한 RPC로 저장한다. SQLite arc/공간 검산은 DB 밖의 계산기 책임이다.
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
  IF s->>'sample_origin'='onboarding' THEN
    PERFORM 1 FROM ag_onboarding_progress o WHERE o.user_id=p_user AND o.completed_at IS NULL AND o.survey_version=prof.survey_version
      AND o.survey_version=(SELECT survey_version FROM ag_preferences WHERE user_id=p_user)
      AND o.case_set_version=s->>'onboarding_case_set_version' AND o.required_case_ids @> jsonb_build_array(s->>'onboarding_case_id');
    IF NOT FOUND THEN RAISE EXCEPTION 'ONBOARDING_CASE_MISMATCH'; END IF;
  ELSIF s->>'onboarding_case_id' IS NOT NULL OR s->>'onboarding_case_set_version' IS NOT NULL THEN RAISE EXCEPTION 'ONBOARDING_CONTEXT_NOT_ALLOWED'; END IF;
  sid:=(s->>'search_id')::uuid; minimum:=(s->>'minimum_internal_duration_s')::float8;
  INSERT INTO ag_searches(search_id,user_id,release_id,profile_version,model_version,departure_at,origin,destination,max_detour_minutes,minimum_internal_duration_s,profile_snapshot,versions,sample_origin,onboarding_case_set_version,onboarding_case_id)
    VALUES(sid,p_user,rel.release_id,prof.profile_version,mdl.model_version,(s->>'departure_at')::timestamptz,s->'origin',s->'destination',(s->>'max_detour_minutes')::smallint,minimum,snap,ver,coalesce(s->>'sample_origin','service'),s->>'onboarding_case_set_version',s->>'onboarding_case_id');
  FOR c IN SELECT value FROM jsonb_array_elements(candidates) LOOP
    IF c->>'search_id' IS DISTINCT FROM sid::text OR c->>'user_id' IS DISTINCT FROM p_user::text OR c->>'release_id' IS DISTINCT FROM rel.release_id THEN RAISE EXCEPTION 'CANDIDATE_CONTEXT_MISMATCH'; END IF;
    IF NOT (c @> ver) OR c->>'profile_version' IS DISTINCT FROM prof.profile_version::text OR c->'profile_weights' IS DISTINCT FROM prof.effective_weights OR c->>'model_version' IS DISTINCT FROM mdl.model_version
       OR c->>'departure_at' IS DISTINCT FROM s->>'departure_at' THEN RAISE EXCEPTION 'CANDIDATE_VERSION_OR_PROFILE_MISMATCH'; END IF;
    IF c->'factor_order' IS DISTINCT FROM '["COMPLEX_INTERSECTION","MERGE_BRANCH","NARROW_ROAD","UNFAMILIAR_TURN","CONSECUTIVE_ACTION","CHILD_ZONE_NEARBY"]'::jsonb
       OR c->'units' IS DISTINCT FROM '["count","score*m","score*m","count","count","m"]'::jsonb THEN RAISE EXCEPTION 'FEATURE_SCHEMA_MISMATCH'; END IF;
    seconds:=(c->>'internal_duration_s')::float8;
    IF seconds<minimum-0.00001 OR seconds>minimum+(s->>'max_detour_minutes')::integer*60+0.00001 THEN RAISE EXCEPTION 'Q3_EXCEEDED_OR_INVALID_MINIMUM'; END IF;
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

CREATE OR REPLACE FUNCTION public.ag_record_exposure(p_user uuid,p_search uuid,p_exposure uuid,p_ids jsonb,p_recommended uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r ag_exposures%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM ag_searches s JOIN users u ON u.id=s.user_id WHERE s.search_id=p_search AND s.user_id=p_user AND u.is_active) THEN RAISE EXCEPTION 'SEARCH_OWNERSHIP_MISMATCH'; END IF;
  IF p_ids IS NULL OR jsonb_typeof(p_ids)<>'array' OR jsonb_array_length(p_ids) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'INVALID_EXPOSURE'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_ids) v WHERE jsonb_typeof(v)<>'string') OR (SELECT count(DISTINCT v) FROM jsonb_array_elements_text(p_ids) v)<>jsonb_array_length(p_ids) THEN RAISE EXCEPTION 'INVALID_EXPOSURE_IDS'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_ids) v WHERE NOT EXISTS(SELECT 1 FROM ag_candidates c WHERE c.candidate_id=v::uuid AND c.search_id=p_search)) THEN RAISE EXCEPTION 'CANDIDATE_NOT_IN_SEARCH'; END IF;
  IF EXISTS(SELECT 1 FROM ag_searches WHERE search_id=p_search AND sample_origin='onboarding') AND jsonb_array_length(p_ids)<>2 THEN RAISE EXCEPTION 'ONBOARDING_TWO_CANDIDATES_REQUIRED'; END IF;
  IF p_recommended IS NOT NULL AND NOT(p_ids @> jsonb_build_array(p_recommended::text)) THEN RAISE EXCEPTION 'RECOMMENDATION_NOT_DISPLAYED'; END IF;
  INSERT INTO ag_exposures(exposure_id,search_id,user_id,displayed_candidate_ids,recommended_candidate_id) VALUES(p_exposure,p_search,p_user,p_ids,p_recommended) ON CONFLICT(exposure_id) DO NOTHING;
  SELECT * INTO STRICT r FROM ag_exposures WHERE exposure_id=p_exposure;
  IF r.search_id<>p_search OR r.user_id<>p_user OR r.displayed_candidate_ids<>p_ids OR r.recommended_candidate_id IS DISTINCT FROM p_recommended THEN RAISE EXCEPTION 'EXPOSURE_ID_CONFLICT'; END IF;
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.ag_record_choice(p_user uuid,p_exposure uuid,p_choice uuid,p_selected uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e ag_exposures%ROWTYPE; r ag_choices%ROWTYPE; o ag_onboarding_progress%ROWTYPE; q ag_searches%ROWTYPE; answered integer;
BEGIN
  SELECT * INTO e FROM ag_exposures WHERE exposure_id=p_exposure AND user_id=p_user;
  IF NOT FOUND OR p_selected IS NULL OR NOT(e.displayed_candidate_ids @> jsonb_build_array(p_selected::text)) THEN RAISE EXCEPTION 'CHOICE_NOT_EXPOSED'; END IF;
  PERFORM 1 FROM users WHERE id=p_user AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
  -- 사용자 잠금 순서를 설문 저장/초기화와 통일해 동시에 답한 Q4도 한 번만 완료한다.
  PERFORM 1 FROM users WHERE id=p_user AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_USER_REQUIRED'; END IF;
  SELECT * INTO q FROM ag_searches WHERE search_id=e.search_id FOR UPDATE;
  IF q.sample_origin='onboarding' THEN
    SELECT * INTO o FROM ag_onboarding_progress WHERE user_id=p_user FOR UPDATE;
    IF o.user_id IS NULL OR o.survey_version::text IS DISTINCT FROM q.profile_snapshot->>'survey_version'
       OR o.case_set_version IS DISTINCT FROM q.onboarding_case_set_version OR NOT(o.required_case_ids @> jsonb_build_array(q.onboarding_case_id))
       OR (o.completed_at IS NULL AND o.survey_version IS DISTINCT FROM (SELECT survey_version FROM ag_preferences WHERE user_id=p_user)) THEN RAISE EXCEPTION 'STALE_ONBOARDING_CASE'; END IF;
  END IF;
  INSERT INTO ag_choices(choice_event_id,exposure_id,search_id,user_id,selected_candidate_id) VALUES(p_choice,p_exposure,e.search_id,p_user,p_selected) ON CONFLICT(search_id) DO NOTHING;
  SELECT * INTO STRICT r FROM ag_choices WHERE search_id=e.search_id;
  IF r.selected_candidate_id<>p_selected THEN RAISE EXCEPTION 'CHOICE_ALREADY_RECORDED'; END IF;
  IF q.sample_origin='onboarding' AND o.completed_at IS NULL THEN
    SELECT count(DISTINCT s.onboarding_case_id) INTO answered FROM ag_choices ch JOIN ag_searches s USING(search_id)
      WHERE ch.user_id=p_user AND s.sample_origin='onboarding' AND s.profile_snapshot->>'survey_version'=o.survey_version::text
        AND s.onboarding_case_set_version=o.case_set_version AND o.required_case_ids @> jsonb_build_array(s.onboarding_case_id);
    IF answered=jsonb_array_length(o.required_case_ids) THEN
      UPDATE ag_onboarding_progress SET completed_at=now() WHERE user_id=p_user;
      UPDATE users SET onboarding=true WHERE id=p_user;
    END IF;
  END IF;
  RETURN to_jsonb(r);
END $$;

-- 현재 SQLite 저장 방식의 학습 내보내기 계약. 원본 README의 full-mirror 전용 exporter 대신 이 view를 읽는다.
CREATE OR REPLACE VIEW public.ag_choice_training_events WITH (security_invoker=true) AS
SELECT ch.*,s.sample_origin,e.displayed_candidate_ids,e.exposed_at,s.departure_at,s.profile_snapshot,s.versions,
       s.profile_snapshot->'effective_weights' AS profile_weights,
       (SELECT jsonb_agg(c.snapshot ORDER BY j.ord) FROM jsonb_array_elements_text(e.displayed_candidate_ids) WITH ORDINALITY j(id,ord)
        JOIN ag_candidates c ON c.candidate_id=j.id::uuid AND c.search_id=s.search_id) AS snapshots
FROM ag_choices ch JOIN ag_exposures e USING(exposure_id) JOIN ag_searches s ON s.search_id=ch.search_id
WHERE ch.event_source='ACTUAL_USER_CHOICE';
REVOKE ALL ON public.ag_choice_training_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ag_choice_training_events TO service_role;

-- 코드에 고정된 동결본을 등록하되, 계산기 검증 전에는 활성화하지 않는다.
INSERT INTO ag_dataset_releases(release_id,dataset_version,contract_version,feature_version,eta_version,routing_policy_version,manifest)
VALUES('anjeon_final_20260915_child100_v3','seoul_static_20260915_review2','anjeon_contract_v6_child100','static_burden_v5_child_circle_inside','internal_hourly_topis_v1','review_exclusion_v1',
  '{"release_id":"anjeon_final_20260915_child100_v3","purpose":"Selected runtime files; byte-level provenance is in IMPORT_MANIFEST.json","files":{"data/roads.gpkg":"d25cd28ea8dd0e1eec28d2c6bd9c6bde25785c7ff00f24a92d71c814cc508052","data/routing.sqlite":"3315de28cecba41b1b6247b48829a68e17de64a0e9314c83cb95a8a35731f460","data/transitions.sqlite":"d2a59b5958e0d9d3d9971c0d0660ee0de332dee94b4228a6803ec257b79fe5b7","data/feature_policy.sqlite":"8ea2af4de0a45dd94d50e62de66cc8e0b4e52d234e4d44218220f1829c2e8e84","data/hourly_speed.sqlite":"9afca69667a8e7f222190e905a023b04d9c25d6671d8f6d565f5165a550eb183","data/child_circle.sqlite":"e4c4c930cc3e77b23d720c8b47ed5e8d02bc90ac4f5a5444b03caf88cb49021d","data/support/features.sqlite":"8baaae44493137503607d8297c9db90f3a617cb30a848193fe0dd32d593a81a7","data/support/graph.sqlite":"efcb9a53b591eef753a704db09b10bc431dc17e73f73bc0f579728c2b1a30970","tools/serve.py":"7d44f34e4c2d21ad36945c60034c54bdd119c862ff30d6fb4f0db9f4fb16e74e","tools/api.py":"9bd7a1adec5cd0e02926c62b3a21f0e028bc8a763c24ca3f8431b61a3eff9864","tools/calculate.py":"b98bc1ff0c4d7aba3b4120b333ab75e7cab36df138c7cfbfeebab7696e6f34b9","tools/examples/hourly_request.json":"5dac512a32888e9a118de950992e8b19df5ff733cbb553efdae45641adbf0cdd","tools/examples/hourly_search.json":"c82ec6880f829cd0cfeda3d77558f354cc200dff3a455adfa555f6d38e8dfca0","tools/runtime/child_feature.py":"9362fe346a2a648955d4be64f8a35126073cc334c376392cfbace808bc7e82ec","tools/runtime/features.py":"5370c9f0108ac51591af9d9343314951d99d211d2c72150b9ee3ec925bde5b94","tools/runtime/hourly.py":"d3b880b73f4d63d5da7c5ec247c7ce1343bacb1aaf36ae48a46faa397747323f","tools/runtime/interface.py":"cfa45a1c05fae81099ad174d78dbc3f739971ca7fa17e720f856ad2cb669623a","tools/runtime/learning.py":"63975439f02c516689c16bd579730d18684a630c815c1cf1dfe31a0daeef3ad9","tools/runtime/routing_service.py":"0225923688d27df5f4d853f2e1369978b69bc29d1a4c3031edbf1df1f220e4e8","tools/runtime/runtime.py":"d458877278a8336732b8f51950c10c0a731089829208776e59fbbf8e059313a1","tools/runtime/search_engine.py":"1c1fdcaac812083468d986765e3308117063242c03886dc1c633ac96d1af076d","tools/runtime/current_feature_contract.json":"c77ae02f38ebd00d6a1a2b302a357fdbeb3328a1b6fdf69c532e14ab7a8753f7","tools/runtime/data_manifest.json":"72fa3e5b8c839f41ea39ac5ec275909b41147ae289c6261b8c6f38783a76a56c","tools/runtime/routing_policy.json":"ef63759f0cce7205de42c2028d7babc54f51361b20e6b6e3df798b25223bbda7","tools/runtime/rules.json":"f7cafc8bf0bc321c3ca5d7a8cf5fbf13aada546d2bb33a91d10b297ec5dc920d","final_release.json":"4bf178c368623209d037b8fa713bd57c5cb4fe9dda053faf48584e3de7d28535","tools/verify_dataset.py":"d2982f471e69944cae1e8892c3bb3028b9ed6f8b221da709138ae6e6d841b6f4","data/seoul_boundary.gpkg":"fbb352cdd576a14e4cf49f5e5d1044278f7dd924f7f8cd687a1e1836d2778fe8","source_register.json":"d0d12817efdd861547d1ee637f963c1117d02db553b1d86ac7944ecaed26e4fa"}}')
ON CONFLICT(release_id) DO NOTHING;
INSERT INTO ag_model_versions(model_version,model_type,contract_version,feature_version,eta_version,is_active)
VALUES('survey_only_v1','survey','anjeon_contract_v6_child100','static_burden_v5_child_circle_inside','internal_hourly_topis_v1',NOT EXISTS(SELECT 1 FROM ag_model_versions WHERE is_active))
ON CONFLICT(model_version) DO NOTHING;

-- 신규 스키마에만 적용한다. 기존 22개 테이블 권한은 변경하지 않는다.
DO $$ DECLARE t text; f text; BEGIN
  FOREACH t IN ARRAY ARRAY['ag_dataset_releases','ag_dataset_active','ag_model_versions','ag_preference_history','ag_preferences','ag_profile_versions','ag_user_profiles','ag_profile_update_jobs','ag_onboarding_progress','ag_searches','ag_candidates','ag_exposures','ag_choices'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM service_role',t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role',t);
  END LOOP;
  -- 작업 예약/모델 등록만 직접 쓰기. 사용자 입력으로 후보·선택을 직접 insert하는 경로는 제공하지 않는다.
  GRANT INSERT,UPDATE ON ag_profile_update_jobs,ag_model_versions TO service_role;
  FOR f IN SELECT oid::regprocedure::text FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'ag\_%' ESCAPE '\' LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM PUBLIC,anon,authenticated,service_role';
  END LOOP;
  GRANT EXECUTE ON FUNCTION ag_start_onboarding(uuid,text,jsonb),ag_save_preferences(uuid,text,jsonb,integer),ag_reset_profile(uuid,boolean),ag_apply_profile_update(uuid,jsonb,double precision,double precision,jsonb),ag_save_search(uuid,jsonb),ag_record_exposure(uuid,uuid,uuid,jsonb,uuid),ag_record_choice(uuid,uuid,uuid,uuid),ag_valid_vector(jsonb,integer,numeric) TO service_role;
END $$;

-- 기존 auth migration 미적용/09-01/09-05 상태만 자동 정합화한다. 알 수 없는 원격 수정본은 덮어쓰지 않는다.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.handle_new_user()') AND md5(replace(prosrc,E'\r','')) NOT IN ('724b1000058663a797065559b7a3ba6f','c54241d7365bd0ea975148e441e0a240')) THEN
  RAISE EXCEPTION 'UNKNOWN_AUTH_TRIGGER: 원격 handle_new_user가 로컬 두 migration과 다릅니다. 먼저 대조하세요';
 END IF;
END $$;
-- ============================================================================
-- 안전하길 · auth.users → public.users 자동 프로필 생성 트리거
-- ============================================================================
-- 근거: 03_Auth_권한_흐름.xlsx
--   - "이메일 회원가입" Step 5: DB Trigger가 auth.users.id/email/user_metadata로
--     public.users row 생성 ("프로필 생성 실패 시 로그인 차단")
--   - "소셜 로그인" Step 3: 동일한 DB Trigger가 email/provider metadata로
--     public.users row 생성 ("추가 아이디 입력 화면 없음")
--
-- 전제:
--   - public.users(id, username, email, nickname, signup_provider,
--                   is_active, onboarding, withdrawn_at, created_at, updated_at)
--   - public.users.id 는 auth.users(id) 를 참조하는 uuid FK 여야 함
--     (아직 아니라면 아래 "사전 점검" 섹션 먼저 실행)
--   - public.users 는 RLS가 켜져 있으므로, 트리거 함수는 SECURITY DEFINER로
--     실행해 RLS를 우회해야 insert가 성공함
--
-- username 규칙(스펙 03시트 Step1 검증 규칙과 동일): ^[a-z][a-z0-9_]{4,19}$
--   - 이메일 가입: Frontend가 signUp() 호출 시 options.data.username 으로 전달
--     → 이미 정규식을 통과한 값이 온다고 가정하고 그대로 사용
--   - 소셜 로그인(구글/카카오): 입력 화면이 없으므로, auth.users.id(uuid)를 이용해
--     정규식을 만족하는 값을 자동 생성 (예: "u" + uuid 앞 10자리, 소문자/숫자만이라
--     정규식 통과. 충돌 확률은 사실상 0에 가까움 — MVP 범위에서는 별도 dedup 불필요)
-- ============================================================================

-- ── 0. (선택) 사전 점검: public.users.id가 auth.users(id) FK인지 확인 ───────
-- 아직 아니라면 아래처럼 맞춰주세요 (컬럼이 이미 uuid이고 데이터가 없다는 전제):
--
-- alter table public.users
--   alter column id set data type uuid using id::uuid,
--   add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- ── 1. 트리거 함수 ──────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_nickname text;
  v_provider text;
begin
  -- username: 이메일 가입은 프론트가 넘겨준 값, 소셜 로그인은 자동 생성
  v_username := new.raw_user_meta_data ->> 'username';
  if v_username is null or v_username !~ '^[a-z][a-z0-9_]{4,19}$' then
    v_username := 'u' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  -- nickname: 이메일 가입은 프론트가 넘겨준 nickname, 소셜은 provider가 준 이름
  -- (ck_users_nickname은 2~10자 한글/영문/숫자만 허용 → 대체값도 반드시 규칙에 맞춰야 함)
  v_nickname := coalesce(
    new.raw_user_meta_data ->> 'nickname',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    substr(v_username, 1, 10)
  );
  if v_nickname !~ '^[가-힣A-Za-z0-9]{2,10}$' then
    v_nickname := substr(v_username, 1, 10);
  end if;

  -- signup_provider: ck_users_signup_provider 제약이 'local'/'google'/'kakao'/'naver'만 허용.
  -- Supabase는 이메일·비밀번호 가입 시 app_metadata.provider에 자동으로 'email'을 넣어주므로
  -- 팀 컨벤션인 'local'로 바꾸고, 네이버는 Custom OAuth라 provider 값이 'custom:naver'로 오는 걸
  -- 실제 확인해서 'custom:' 접두사를 떼어내도록 처리
  v_provider := coalesce(new.raw_app_meta_data ->> 'provider', 'local');
  if v_provider = 'email' then
    v_provider := 'local';
  elsif v_provider like 'custom:%' then
    v_provider := substr(v_provider, 8);
  end if;

  insert into public.users (
    id, username, email, nickname, signup_provider,
    is_active, onboarding, created_at, updated_at
  )
  values (
    new.id,
    v_username,
    new.email,          -- 카카오 등 이메일 미동의 시 null일 수 있음(허용 여부는 email 컬럼 제약과 함께 팀 결정 필요)
    v_nickname,
    v_provider,
    true,
    false,
    now(),
    now()
  )
  -- 소셜 로그인은 INSERT/UPDATE 두 트리거가 같은 가입 이벤트에서 함께 실행될 수 있어
  -- 이미 프로필이 있으면 조용히 무시(중복 PK 에러로 로그인 자체가 막히는 것 방지)
  on conflict (id) do nothing;

  return new;
exception
  when others then
    -- 스펙 명시대로 "프로필 생성 실패 시 로그인 차단": 예외를 그대로 올려서
    -- auth.users insert(=가입 자체)까지 롤백되게 함
    raise exception 'public.users 프로필 생성 실패 (auth.users.id=%): %', new.id, sqlerrm;
end;
$$;

-- ── 2. 트리거 등록 ──────────────────────────────────────────────────────────
-- 재실행해도 에러 없이 덮어써지도록 기존 트리거를 먼저 정리
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_confirmed on auth.users;
drop trigger if exists on_auth_user_created_confirmed on auth.users;

-- 이메일/비밀번호 가입: signUp() 시점엔 email_confirmed_at이 null이었다가,
-- 6자리 인증번호 확인(verifyOtp) 성공 시 null → not null로 바뀌는 순간 실행
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_user();

-- 소셜 로그인(네이버/카카오/구글): 이메일 동의를 안 한 계정은 email/
-- email_confirmed_at이 둘 다 null로 들어오기도 해서 email_confirmed_at로는
-- 판별 불가 → provider가 'email'(자체 가입)이 아니면 무조건 즉시 생성
create trigger on_auth_user_created_confirmed
  after insert on auth.users
  for each row
  when (coalesce(new.raw_app_meta_data ->> 'provider', 'email') <> 'email')
  execute function public.handle_new_user();

-- ============================================================================
-- 테스트 방법
-- ============================================================================
-- 1) Supabase 대시보드 SQL Editor에서 이 파일 전체 실행
-- 2) 지금까지 하신 것처럼 브라우저에서
--    https://<project-ref>.supabase.co/auth/v1/authorize?provider=google 로 로그인
-- 3) SQL Editor에서 아래 쿼리로 확인
--    select * from public.users order by created_at desc limit 5;
--    → username(u로 시작하는 자동생성 값), signup_provider='google' 등이
--      정상적으로 채워졌는지 확인
-- ============================================================================

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
COMMIT;
