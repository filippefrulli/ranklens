-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.analysis_runs (
  business_id uuid NOT NULL,
  run_date date NOT NULL,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status character varying DEFAULT 'pending'::character varying,
  total_queries integer NOT NULL DEFAULT 0,
  completed_queries integer DEFAULT 0,
  total_llm_calls integer DEFAULT 0,
  completed_llm_calls integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT analysis_runs_pkey PRIMARY KEY (id),
  CONSTRAINT analysis_runs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.businesses (
  user_id uuid NOT NULL UNIQUE,
  google_place_id character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  city character varying,
  google_primary_type character varying,
  google_primary_type_display character varying,
  google_types jsonb,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT businesses_pkey PRIMARY KEY (id),
  CONSTRAINT businesses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.competitor_results (
  query_id uuid NOT NULL,
  analysis_run_id uuid NOT NULL,
  business_name text NOT NULL,
  average_rank numeric CHECK (average_rank > 0::numeric),
  best_rank integer CHECK (best_rank > 0),
  worst_rank integer CHECK (worst_rank > 0),
  weighted_score numeric,
  llm_providers ARRAY,
  raw_ranks ARRAY,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appearances_count integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 0,
  appearance_rate numeric DEFAULT (((appearances_count)::numeric / (total_attempts)::numeric) * (100)::numeric) CHECK (appearance_rate >= 0::numeric AND appearance_rate <= 100::numeric),
  is_user_business boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT competitor_results_pkey PRIMARY KEY (id),
  CONSTRAINT competitor_results_query_id_fkey FOREIGN KEY (query_id) REFERENCES public.queries(id),
  CONSTRAINT competitor_results_analysis_run_id_fkey FOREIGN KEY (analysis_run_id) REFERENCES public.analysis_runs(id)
);
CREATE TABLE public.llm_providers (
  name character varying NOT NULL UNIQUE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  supports_sources boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT llm_providers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.queries (
  business_id uuid NOT NULL,
  text text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT queries_pkey PRIMARY KEY (id),
  CONSTRAINT queries_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
CREATE TABLE public.ranking_attempts (
  analysis_run_id uuid NOT NULL,
  query_id uuid NOT NULL,
  llm_provider_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 5),
  raw_response text,
  parsed_ranking jsonb,
  target_business_rank integer,
  error_message text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  success boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ranking_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT ranking_attempts_analysis_run_id_fkey FOREIGN KEY (analysis_run_id) REFERENCES public.analysis_runs(id),
  CONSTRAINT ranking_attempts_llm_provider_id_fkey FOREIGN KEY (llm_provider_id) REFERENCES public.llm_providers(id),
  CONSTRAINT ranking_attempts_query_id_fkey FOREIGN KEY (query_id) REFERENCES public.queries(id)
);
CREATE TABLE public.ranking_sources (
  ranking_attempt_id uuid NOT NULL,
  business_name character varying NOT NULL,
  rank_position integer NOT NULL,
  source_url character varying,
  source_title character varying,
  source_domain character varying,
  source_type character varying,
  excerpt text,
  relevance_score numeric,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ranking_sources_pkey PRIMARY KEY (id),
  CONSTRAINT ranking_sources_ranking_attempt_id_fkey FOREIGN KEY (ranking_attempt_id) REFERENCES public.ranking_attempts(id)
);