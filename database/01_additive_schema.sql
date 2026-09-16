-- Run after the supplied baseline. Adds versioned tables; preserves all legacy rows.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ag_dataset_releases (
 release_id text PRIMARY KEY, dataset_version text NOT NULL, contract_version text NOT NULL,
 feature_version text NOT NULL, eta_version text NOT NULL, routing_policy_version text NOT NULL,
 manifest jsonb NOT NULL, expected_counts jsonb NOT NULL, status text NOT NULL DEFAULT 'staging' CHECK(status IN ('staging','ready')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ag_dataset_active (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), release_id text NOT NULL REFERENCES public.ag_dataset_releases(release_id), activated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ag_nodes (
 release_id text NOT NULL REFERENCES public.ag_dataset_releases(release_id), node_id bigint NOT NULL,
 x_5186 double precision NOT NULL,y_5186 double precision NOT NULL,longitude double precision NOT NULL,latitude double precision NOT NULL,
 PRIMARY KEY(release_id,node_id)
);
CREATE TABLE IF NOT EXISTS public.ag_edges (
 release_id text NOT NULL REFERENCES public.ag_dataset_releases(release_id),edge_id bigint NOT NULL,
 osm_way_id bigint NOT NULL,length_m double precision NOT NULL CHECK(length_m>0),road_name text,highway text,
 narrow_score double precision CHECK(narrow_score BETWEEN 0 AND 1),narrow_basis text NOT NULL,narrow_estimated boolean NOT NULL,
 child_nearby boolean NOT NULL,child_inside_length_m double precision NOT NULL CHECK(child_inside_length_m>=0),child_inside_intervals jsonb NOT NULL CHECK(jsonb_typeof(child_inside_intervals)='array'),geometry_geojson jsonb NOT NULL,attributes jsonb NOT NULL,
 PRIMARY KEY(release_id,edge_id)
);
CREATE TABLE IF NOT EXISTS public.ag_arcs (
 release_id text NOT NULL,arc_id bigint NOT NULL,edge_id bigint NOT NULL,from_node bigint NOT NULL,to_node bigint NOT NULL,
 length_m double precision NOT NULL CHECK(length_m>0),static_eligible boolean NOT NULL,
 merge_score double precision CHECK(merge_score BETWEEN 0 AND 1),merge_basis text NOT NULL,merge_estimated boolean NOT NULL,
 fallback_kph double precision CHECK(fallback_kph>0),fallback_basis text NOT NULL,
 PRIMARY KEY(release_id,arc_id),
 FOREIGN KEY(release_id,edge_id) REFERENCES public.ag_edges(release_id,edge_id),
 FOREIGN KEY(release_id,from_node) REFERENCES public.ag_nodes(release_id,node_id),
 FOREIGN KEY(release_id,to_node) REFERENCES public.ag_nodes(release_id,node_id)
);
CREATE TABLE IF NOT EXISTS public.ag_topis_links (
 release_id text NOT NULL REFERENCES public.ag_dataset_releases(release_id),topis_link_id text NOT NULL,road_name text,
 from_to text,source_length_m double precision,identity_status text NOT NULL,geometry_geojson jsonb,
 PRIMARY KEY(release_id,topis_link_id)
);
CREATE TABLE IF NOT EXISTS public.ag_hourly_profiles (
 release_id text NOT NULL,topis_link_id text NOT NULL,weekend smallint NOT NULL CHECK(weekend IN(0,1)),
 hour smallint NOT NULL CHECK(hour BETWEEN 0 AND 23),n_days integer NOT NULL CHECK(n_days>=0),median_kph double precision CHECK(median_kph>0),p10_kph double precision,p90_kph double precision,
 PRIMARY KEY(release_id,topis_link_id,weekend,hour),FOREIGN KEY(release_id,topis_link_id) REFERENCES public.ag_topis_links(release_id,topis_link_id)
);
CREATE TABLE IF NOT EXISTS public.ag_arc_speed_mapping (
 release_id text NOT NULL,arc_id bigint NOT NULL,topis_link_id text,matched boolean NOT NULL,reason text NOT NULL,
 max_distance_m double precision,mean_distance_m double precision,max_angle_deg double precision,
 source_fraction_start double precision,source_fraction_end double precision,
 PRIMARY KEY(release_id,arc_id),FOREIGN KEY(release_id,arc_id) REFERENCES public.ag_arcs(release_id,arc_id),
 FOREIGN KEY(release_id,topis_link_id) REFERENCES public.ag_topis_links(release_id,topis_link_id),
 CHECK((matched AND topis_link_id IS NOT NULL) OR (NOT matched AND topis_link_id IS NULL))
);
CREATE TABLE IF NOT EXISTS public.ag_transitions (
 release_id text NOT NULL,from_arc bigint NOT NULL,to_arc bigint NOT NULL,via_node bigint NOT NULL,
 complex_proxy double precision NOT NULL,unfamiliar_proxy double precision NOT NULL,is_allowed boolean NOT NULL,attributes jsonb NOT NULL,
 PRIMARY KEY(release_id,from_arc,to_arc),FOREIGN KEY(release_id,from_arc) REFERENCES public.ag_arcs(release_id,arc_id),FOREIGN KEY(release_id,to_arc) REFERENCES public.ag_arcs(release_id,arc_id)
);
CREATE TABLE IF NOT EXISTS public.ag_restrictions (
 release_id text NOT NULL REFERENCES public.ag_dataset_releases(release_id),relation_id bigint NOT NULL,kind text NOT NULL CHECK(kind IN('no','only')),
 arc_ids jsonb NOT NULL CHECK(jsonb_typeof(arc_ids)='array'),PRIMARY KEY(release_id,relation_id,arc_ids)
);
CREATE TABLE IF NOT EXISTS public.ag_preferences (
 user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 driving_frequency text NOT NULL,ranks jsonb NOT NULL CHECK(jsonb_typeof(ranks)='array' AND jsonb_array_length(ranks)=6),
 max_detour_minutes smallint CHECK(max_detour_minutes IN(0,5,10,15)),profile_weights jsonb NOT NULL CHECK(jsonb_array_length(profile_weights)=6),
 profile_version uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ag_preference_history (
 profile_version uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ag_searches (
 search_id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 release_id text NOT NULL REFERENCES public.ag_dataset_releases(release_id),departure_at timestamptz NOT NULL,
 origin jsonb NOT NULL,destination jsonb NOT NULL,max_detour_minutes smallint NOT NULL CHECK(max_detour_minutes IN(0,5,10,15)),
 minimum_internal_duration_s double precision NOT NULL CHECK(minimum_internal_duration_s>=0),
 profile_snapshot jsonb NOT NULL,versions jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ag_candidates (
 candidate_id uuid PRIMARY KEY,search_id uuid NOT NULL REFERENCES public.ag_searches(search_id) ON DELETE CASCADE,
 release_id text NOT NULL,route_types jsonb NOT NULL,segments jsonb NOT NULL,
 distance_m double precision NOT NULL CHECK(distance_m>0),internal_duration_s double precision NOT NULL CHECK(internal_duration_s>0),
 display_duration_s double precision NOT NULL CHECK(display_duration_s>=0),display_duration_source text NOT NULL,
 raw6 jsonb NOT NULL CHECK(jsonb_typeof(raw6)='array' AND jsonb_array_length(raw6)=6),
 geometry_geojson jsonb NOT NULL,hourly_coverage jsonb NOT NULL,quality jsonb NOT NULL,snapshot jsonb NOT NULL,
 FOREIGN KEY(release_id) REFERENCES public.ag_dataset_releases(release_id)
);
CREATE TABLE IF NOT EXISTS public.ag_candidate_segments (
 candidate_id uuid NOT NULL REFERENCES public.ag_candidates(candidate_id) ON DELETE CASCADE,
 seq integer NOT NULL CHECK(seq>=0),release_id text NOT NULL,arc_id bigint NOT NULL,
 start_fraction double precision NOT NULL,end_fraction double precision NOT NULL,
 PRIMARY KEY(candidate_id,seq),FOREIGN KEY(release_id,arc_id) REFERENCES public.ag_arcs(release_id,arc_id),
 CHECK(start_fraction>=0 AND start_fraction<end_fraction AND end_fraction<=1)
);
CREATE TABLE IF NOT EXISTS public.ag_exposures (
 exposure_id uuid PRIMARY KEY,search_id uuid NOT NULL REFERENCES public.ag_searches(search_id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 displayed_candidate_ids jsonb NOT NULL CHECK(jsonb_typeof(displayed_candidate_ids)='array'),
 exposed_at timestamptz NOT NULL DEFAULT now(),UNIQUE(exposure_id,search_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.ag_choices (
 choice_event_id uuid PRIMARY KEY,exposure_id uuid NOT NULL UNIQUE,search_id uuid NOT NULL,user_id uuid NOT NULL,
 selected_candidate_id uuid NOT NULL REFERENCES public.ag_candidates(candidate_id),chosen_at timestamptz NOT NULL DEFAULT now(),
 event_source text NOT NULL CHECK(event_source='ACTUAL_USER_CHOICE'),sample_origin text NOT NULL CHECK(sample_origin IN('service','onboarding','study')),
 FOREIGN KEY(exposure_id,search_id,user_id) REFERENCES public.ag_exposures(exposure_id,search_id,user_id)
);
CREATE INDEX IF NOT EXISTS ag_searches_user_time ON public.ag_searches(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ag_candidates_search ON public.ag_candidates(search_id);
CREATE INDEX IF NOT EXISTS ag_arcs_from_node ON public.ag_arcs(release_id,from_node);
CREATE INDEX IF NOT EXISTS ag_arc_speed_source ON public.ag_arc_speed_mapping(release_id,topis_link_id) WHERE matched;
COMMIT;
