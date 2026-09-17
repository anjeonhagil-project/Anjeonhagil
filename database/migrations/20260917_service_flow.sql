BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.ag_exposures ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{"policy":"legacy_rendered_v1"}';
CREATE OR REPLACE FUNCTION public.ag_record_exposure_v2(p_user uuid,p_search uuid,p_exposure uuid,p_ids jsonb,p_recommended uuid,p_context jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r ag_exposures%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM ag_searches s JOIN users u ON u.id=s.user_id WHERE s.search_id=p_search AND s.user_id=p_user AND u.is_active) THEN RAISE EXCEPTION 'SEARCH_OWNERSHIP_MISMATCH'; END IF;
 IF p_ids IS NULL OR jsonb_typeof(p_ids)<>'array' OR jsonb_array_length(p_ids) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'INVALID_EXPOSURE'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_ids) v WHERE jsonb_typeof(v)<>'string') OR (SELECT count(DISTINCT v) FROM jsonb_array_elements_text(p_ids) v)<>jsonb_array_length(p_ids) THEN RAISE EXCEPTION 'INVALID_EXPOSURE_IDS'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_ids) v WHERE NOT EXISTS(SELECT 1 FROM ag_candidates c WHERE c.candidate_id=v::uuid AND c.search_id=p_search)) THEN RAISE EXCEPTION 'CANDIDATE_NOT_IN_SEARCH'; END IF;
 IF p_recommended IS NOT NULL AND (NOT(p_ids @> jsonb_build_array(p_recommended::text)) OR p_recommended::text IS DISTINCT FROM (SELECT response_snapshot->>'recommendedCandidateId' FROM ag_searches WHERE search_id=p_search)) THEN RAISE EXCEPTION 'RECOMMENDATION_NOT_DISPLAYED'; END IF;
 IF p_context->>'policy' IS DISTINCT FROM 'visible_cards_v2' OR jsonb_typeof(p_context)<>'object' OR octet_length(p_context::text)>1024 THEN RAISE EXCEPTION 'INVALID_EXPOSURE_CONTEXT'; END IF;
 INSERT INTO ag_exposures(exposure_id,search_id,user_id,displayed_candidate_ids,recommended_candidate_id,context) VALUES(p_exposure,p_search,p_user,p_ids,p_recommended,p_context) ON CONFLICT(exposure_id) DO NOTHING;
 SELECT * INTO STRICT r FROM ag_exposures WHERE exposure_id=p_exposure;
 IF r.search_id<>p_search OR r.user_id<>p_user OR r.displayed_candidate_ids<>p_ids OR r.recommended_candidate_id IS DISTINCT FROM p_recommended OR r.context<>p_context THEN RAISE EXCEPTION 'EXPOSURE_ID_CONFLICT'; END IF;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.ag_record_exposure_v2(uuid,uuid,uuid,jsonb,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ag_record_exposure_v2(uuid,uuid,uuid,jsonb,uuid,jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.ag_personalization_queue (
 user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 1, completed_revision bigint NOT NULL DEFAULT 0,
 lease_token uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 requested_at timestamptz NOT NULL DEFAULT now(), last_error text
);
ALTER TABLE public.ag_personalization_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ag_personalization_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ag_personalization_queue TO service_role;
INSERT INTO public.ag_personalization_queue(user_id)
 SELECT DISTINCT user_id FROM public.ag_profile_update_jobs WHERE status IN ('queued','running','failed')
 ON CONFLICT(user_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.ag_enqueue_personalization() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO ag_personalization_queue(user_id) VALUES(NEW.user_id)
 ON CONFLICT(user_id) DO UPDATE SET revision=ag_personalization_queue.revision+1,requested_at=now();
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ag_choice_personalization_queue ON public.ag_choices;
CREATE TRIGGER ag_choice_personalization_queue AFTER INSERT ON public.ag_choices FOR EACH ROW EXECUTE FUNCTION public.ag_enqueue_personalization();
CREATE OR REPLACE FUNCTION public.ag_claim_personalization() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r ag_personalization_queue%ROWTYPE;
BEGIN
 SELECT * INTO r FROM ag_personalization_queue WHERE revision>completed_revision AND (lease_until IS NULL OR lease_until<now()) ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE ag_personalization_queue SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 WHERE user_id=r.user_id RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION public.ag_finish_personalization(p_user uuid,p_token uuid,p_revision bigint,p_error text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE ag_personalization_queue SET completed_revision=CASE WHEN p_error IS NULL THEN greatest(completed_revision,p_revision) ELSE completed_revision END,
 lease_token=NULL,lease_until=CASE WHEN p_error IS NULL THEN NULL ELSE now()+interval '30 seconds' END,last_error=left(p_error,100),attempts=CASE WHEN p_error IS NULL THEN 0 ELSE attempts END
 WHERE user_id=p_user AND lease_token=p_token;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.ag_enqueue_personalization(),public.ag_claim_personalization(),public.ag_finish_personalization(uuid,uuid,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ag_claim_personalization(),public.ag_finish_personalization(uuid,uuid,bigint,text) TO service_role;
CREATE OR REPLACE VIEW public.ag_choice_training_events WITH (security_invoker=true) AS
 SELECT ch.*,s.sample_origin,e.displayed_candidate_ids,e.exposed_at,s.departure_at,s.profile_snapshot,s.versions,
 s.profile_snapshot->'effective_weights' AS profile_weights,
 (SELECT jsonb_agg(c.snapshot ORDER BY j.ord) FROM jsonb_array_elements_text(e.displayed_candidate_ids) WITH ORDINALITY j(id,ord)
 JOIN ag_candidates c ON c.candidate_id=j.id::uuid AND c.search_id=s.search_id) AS snapshots,
 e.context AS exposure_context,s.response_snapshot->>'recommendedCandidateId' AS original_recommended_candidate_id
 FROM ag_choices ch JOIN ag_exposures e USING(exposure_id) JOIN ag_searches s ON s.search_id=ch.search_id WHERE ch.event_source='ACTUAL_USER_CHOICE' AND s.sample_origin='service';
NOTIFY pgrst,'reload schema';
COMMIT;
