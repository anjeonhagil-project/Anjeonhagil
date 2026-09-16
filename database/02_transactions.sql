BEGIN;
CREATE OR REPLACE FUNCTION public.ag_save_preferences(p_user uuid,p_frequency text,p_ranks jsonb,p_q3 integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k integer; i integer; r integer; rank_values integer[]; w double precision[]; v uuid:=gen_random_uuid(); result jsonb;
BEGIN
 IF jsonb_typeof(p_ranks)<>'array' OR jsonb_array_length(p_ranks)<>6 THEN RAISE EXCEPTION 'SIX_RANKS_REQUIRED'; END IF;
 IF p_frequency NOT IN ('daily','weekly','monthly','rarely','never') THEN RAISE EXCEPTION 'INVALID_DRIVING_FREQUENCY'; END IF;
 IF p_q3 IS NOT NULL AND p_q3 NOT IN(0,5,10,15) THEN RAISE EXCEPTION 'INVALID_Q3'; END IF;
 FOR i IN 0..5 LOOP
  IF jsonb_typeof(p_ranks->i)<>'number' OR (p_ranks->>i)!~'^[0-6]$' THEN RAISE EXCEPTION 'INTEGER_RANK_REQUIRED'; END IF;
  rank_values:=array_append(rank_values,(p_ranks->>i)::integer);
 END LOOP;
 SELECT count(*) INTO k FROM unnest(rank_values) x WHERE x>0;
 IF (SELECT count(DISTINCT x) FROM unnest(rank_values) x WHERE x>0)<>k OR coalesce((SELECT max(x) FROM unnest(rank_values) x),0)<>k THEN RAISE EXCEPTION 'RANKS_MUST_BE_CONTIGUOUS'; END IF;
 FOREACH r IN ARRAY rank_values LOOP w:=array_append(w,CASE WHEN r=0 THEN 0.0 ELSE (k-r+1)::double precision/(k*(k+1)/2.0) END); END LOOP;
 INSERT INTO ag_preferences VALUES(p_user,p_frequency,p_ranks,p_q3,to_jsonb(w),v,now())
 ON CONFLICT(user_id) DO UPDATE SET driving_frequency=excluded.driving_frequency,ranks=excluded.ranks,max_detour_minutes=excluded.max_detour_minutes,profile_weights=excluded.profile_weights,profile_version=excluded.profile_version,updated_at=excluded.updated_at;
 SELECT to_jsonb(p) INTO result FROM ag_preferences p WHERE user_id=p_user;
 INSERT INTO ag_preference_history(profile_version,user_id,snapshot) VALUES(v,p_user,result);
 UPDATE users SET onboarding=true WHERE id=p_user;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.ag_save_search(p_user uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE release ag_dataset_releases%ROWTYPE; pref ag_preference_history%ROWTYPE; s jsonb:=p_payload->'search'; c jsonb; seg jsonb; cid uuid; sid uuid:=(p_payload->'search'->>'search_id')::uuid; idx integer; measured double precision; a ag_arcs%ROWTYPE; lo double precision; hi double precision; child_measured double precision; edge_lo double precision; edge_hi double precision; iv jsonb; inside_intervals jsonb;
BEGIN
 SELECT r.* INTO release FROM ag_dataset_active x JOIN ag_dataset_releases r USING(release_id) WHERE x.singleton AND r.status='ready';
 IF NOT FOUND OR release.release_id<>s->>'release_id' THEN RAISE EXCEPTION 'ACTIVE_DATASET_MISMATCH'; END IF;
 IF (s->'versions'->>'dataset_version') IS DISTINCT FROM release.dataset_version OR (s->'versions'->>'contract_version') IS DISTINCT FROM release.contract_version OR (s->'versions'->>'feature_version') IS DISTINCT FROM release.feature_version OR (s->'versions'->>'eta_version') IS DISTINCT FROM release.eta_version OR (s->'versions'->>'routing_policy_version') IS DISTINCT FROM release.routing_policy_version THEN RAISE EXCEPTION 'CALCULATION_VERSION_MISMATCH'; END IF;
 IF (s->>'max_detour_minutes')::integer NOT IN(0,5,10,15) THEN RAISE EXCEPTION 'INVALID_Q3'; END IF;
 SELECT * INTO pref FROM ag_preference_history WHERE profile_version=(s->'profile_snapshot'->>'profile_version')::uuid AND user_id=p_user;
 IF NOT FOUND OR pref.snapshot<>s->'profile_snapshot' THEN RAISE EXCEPTION 'PROFILE_SNAPSHOT_MISMATCH'; END IF;
 IF jsonb_typeof(p_payload->'candidates')<>'array' OR jsonb_array_length(p_payload->'candidates') NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'CANDIDATES_REQUIRED'; END IF;
 INSERT INTO ag_searches VALUES(sid,p_user,release.release_id,(s->>'departure_at')::timestamptz,s->'origin',s->'destination',(s->>'max_detour_minutes')::smallint,(s->>'minimum_internal_duration_s')::double precision,s->'profile_snapshot',s->'versions',now());
 FOR c IN SELECT value FROM jsonb_array_elements(p_payload->'candidates') LOOP
  cid:=(c->>'candidate_id')::uuid;
  IF (c->>'user_id')::uuid IS DISTINCT FROM p_user OR (c->>'search_id')::uuid IS DISTINCT FROM sid OR (c->>'release_id') IS DISTINCT FROM release.release_id THEN RAISE EXCEPTION 'CANDIDATE_CONTEXT_MISMATCH'; END IF;
  IF (c->>'dataset_version') IS DISTINCT FROM release.dataset_version OR (c->>'contract_version') IS DISTINCT FROM release.contract_version OR (c->>'feature_version') IS DISTINCT FROM release.feature_version OR (c->>'eta_version') IS DISTINCT FROM release.eta_version OR (c->>'routing_policy_version') IS DISTINCT FROM release.routing_policy_version THEN RAISE EXCEPTION 'CANDIDATE_VERSION_MISMATCH'; END IF;
  IF (c->>'profile_version')::uuid IS DISTINCT FROM pref.profile_version OR (c->'profile_weights') IS DISTINCT FROM (pref.snapshot->'profile_weights') OR (c->>'departure_at')::timestamptz IS DISTINCT FROM (s->>'departure_at')::timestamptz THEN RAISE EXCEPTION 'CANDIDATE_PROFILE_TIME_MISMATCH'; END IF;

  IF (c->>'internal_duration_s')::double precision>(s->>'minimum_internal_duration_s')::double precision+(s->>'max_detour_minutes')::integer*60+0.00001 THEN RAISE EXCEPTION 'Q3_EXCEEDED'; END IF;
  IF jsonb_array_length(c->'raw_features')<>6 OR EXISTS(SELECT 1 FROM jsonb_array_elements(c->'raw_features') x WHERE jsonb_typeof(x)<>'number' OR x::text::double precision<0) THEN RAISE EXCEPTION 'INVALID_RAW6'; END IF;
  IF c->'factor_order' IS DISTINCT FROM '["COMPLEX_INTERSECTION","MERGE_BRANCH","NARROW_ROAD","UNFAMILIAR_TURN","CONSECUTIVE_ACTION","CHILD_ZONE_NEARBY"]'::jsonb THEN RAISE EXCEPTION 'FEATURE_ORDER_MISMATCH'; END IF;
  IF c->>'display_duration_source'<>'INTERNAL_HOURLY' OR abs((c->>'display_duration_s')::double precision-round((c->>'internal_duration_s')::numeric/60)*60)>0.00001 THEN RAISE EXCEPTION 'DISPLAY_TIME_MISMATCH'; END IF;
  IF jsonb_typeof(c->'segments')<>'array' OR jsonb_array_length(c->'segments')=0 THEN RAISE EXCEPTION 'SEGMENTS_REQUIRED'; END IF;
  INSERT INTO ag_candidates VALUES(cid,sid,release.release_id,c->'route_types',c->'segments',(c->>'distance_m')::double precision,(c->>'internal_duration_s')::double precision,(c->>'display_duration_s')::double precision,c->>'display_duration_source',c->'raw_features',c->'geometry',c->'hourly_speed_coverage',c->'quality',c);
  idx:=0;measured:=0;child_measured:=0;
  FOR seg IN SELECT value FROM jsonb_array_elements(c->'segments') LOOP
   SELECT * INTO a FROM ag_arcs WHERE release_id=release.release_id AND arc_id=(seg->>'arc_id')::bigint AND static_eligible;
   IF NOT FOUND THEN RAISE EXCEPTION 'ARC_NOT_IN_ACTIVE_GRAPH'; END IF;
   lo:=coalesce((seg->>'start_fraction')::double precision,0);hi:=coalesce((seg->>'end_fraction')::double precision,1);
   INSERT INTO ag_candidate_segments VALUES(cid,idx,release.release_id,a.arc_id,lo,hi);
   measured:=measured+a.length_m*(hi-lo);idx:=idx+1;
   SELECT e.child_inside_intervals INTO inside_intervals FROM ag_edges e WHERE e.release_id=release.release_id AND e.edge_id=a.edge_id;
   IF a.arc_id%2=0 THEN edge_lo:=lo;edge_hi:=hi; ELSE edge_lo:=1-hi;edge_hi:=1-lo; END IF;
   FOR iv IN SELECT value FROM jsonb_array_elements(inside_intervals) LOOP
    child_measured:=child_measured+a.length_m*greatest(0.0,least(edge_hi,(iv->>1)::double precision)-greatest(edge_lo,(iv->>0)::double precision));
   END LOOP;
  END LOOP;
  IF abs(measured-(c->>'distance_m')::double precision)>0.001 THEN RAISE EXCEPTION 'SEGMENT_DISTANCE_MISMATCH'; END IF;
  IF jsonb_typeof(c->'raw_features'->5) IS DISTINCT FROM 'number' OR abs(child_measured-(c->'raw_features'->>5)::double precision)>0.001 THEN RAISE EXCEPTION 'CHILD_FEATURE_GEOMETRY_MISMATCH'; END IF;
  IF jsonb_typeof(c->'quality'->'child_circle_inside_m') IS DISTINCT FROM 'number' OR abs(child_measured-(c->'quality'->>'child_circle_inside_m')::double precision)>0.001 THEN RAISE EXCEPTION 'CHILD_QUALITY_GEOMETRY_MISMATCH'; END IF;
 END LOOP;
 RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.ag_record_exposure(p_user uuid,p_search uuid,p_exposure uuid,p_ids jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result ag_exposures%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM ag_searches WHERE search_id=p_search AND user_id=p_user) THEN RAISE EXCEPTION 'SEARCH_OWNERSHIP_MISMATCH'; END IF;
 IF jsonb_typeof(p_ids)<>'array' OR jsonb_array_length(p_ids)<1 OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_ids))<>jsonb_array_length(p_ids) THEN RAISE EXCEPTION 'INVALID_EXPOSURE'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_ids) x WHERE NOT EXISTS(SELECT 1 FROM ag_candidates c WHERE c.candidate_id=x::uuid AND c.search_id=p_search)) THEN RAISE EXCEPTION 'CANDIDATE_NOT_IN_SEARCH'; END IF;
 INSERT INTO ag_exposures VALUES(p_exposure,p_search,p_user,p_ids,now()) ON CONFLICT(exposure_id) DO NOTHING;
 SELECT * INTO result FROM ag_exposures WHERE exposure_id=p_exposure;
 IF result.user_id<>p_user OR result.search_id<>p_search OR result.displayed_candidate_ids<>p_ids THEN RAISE EXCEPTION 'EXPOSURE_ID_CONFLICT'; END IF;
 RETURN to_jsonb(result);
END $$;

CREATE OR REPLACE FUNCTION public.ag_record_choice(p_user uuid,p_exposure uuid,p_choice uuid,p_selected uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE exposure ag_exposures%ROWTYPE; result ag_choices%ROWTYPE;
BEGIN
 SELECT * INTO exposure FROM ag_exposures WHERE exposure_id=p_exposure AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR NOT(exposure.displayed_candidate_ids @> jsonb_build_array(p_selected::text)) THEN RAISE EXCEPTION 'CHOICE_NOT_EXPOSED'; END IF;
 INSERT INTO ag_choices VALUES(p_choice,p_exposure,exposure.search_id,p_user,p_selected,now(),'ACTUAL_USER_CHOICE','service') ON CONFLICT(exposure_id) DO NOTHING;
 SELECT * INTO result FROM ag_choices WHERE exposure_id=p_exposure;
 IF result.selected_candidate_id<>p_selected THEN RAISE EXCEPTION 'CHOICE_ALREADY_RECORDED'; END IF;
 RETURN to_jsonb(result);
END $$;
-- The service-role backend owns these mutations; clients cannot write fake labels directly.
DO $$ DECLARE t text; f text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ag\_%' ESCAPE '\' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON public.%I FROM anon',t); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',t); END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN EXECUTE format('GRANT ALL ON public.%I TO service_role',t); END IF;
 END LOOP;
 FOR f IN SELECT oid::regprocedure::text FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('ag_save_preferences','ag_save_search','ag_record_exposure','ag_record_choice') LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM PUBLIC';
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM anon'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON FUNCTION '||f||' FROM authenticated'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN EXECUTE 'GRANT EXECUTE ON FUNCTION '||f||' TO service_role'; END IF;
 END LOOP;
END $$;
COMMIT;
