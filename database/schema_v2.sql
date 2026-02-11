-- ============================================================================
-- RankLens Schema v2 — MVP
-- ============================================================================
-- Hierarchy: Company → Products → Measurements
-- Analysis:  analysis_runs → ranking_attempts → competitor_results (aggregated)
--
-- Design goals:
--   • Simple — fewest tables that cover the MVP
--   • Secure — RLS on every user table
--   • Fast   — indexes on every query the frontend will run
--   • Easy to extend later (add columns/tables, not re-architect)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CORE ENTITIES
-- ============================================================================

-- One company per user. Name from Google Business or entered manually.
CREATE TABLE public.companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name        varchar(255) NOT NULL,

  -- Optional Google Business lookup
  google_place_id              varchar(255) UNIQUE,
  google_primary_type          varchar(255),
  google_primary_type_display  varchar(255),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT companies_name_not_empty CHECK (char_length(name) > 0)
);

-- Products tracked per company (e.g. iPhone, iPad, Mac)
CREATE TABLE public.products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name          varchar(255) NOT NULL,
  description   text,          -- helps LLM understand the product
  image_url     text,          -- user-uploaded product image (Supabase Storage URL)

  display_order integer  NOT NULL DEFAULT 0,
  is_active     boolean  NOT NULL DEFAULT true,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT products_name_not_empty     CHECK (char_length(name) > 0),
  CONSTRAINT products_description_length CHECK (description IS NULL OR char_length(description) <= 1000),
  CONSTRAINT products_company_name_unique UNIQUE (company_id, name)
);

-- User-defined queries per product (up to 100, enforced in app)
CREATE TABLE public.measurements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  title         varchar(255) NOT NULL,   -- short label shown in UI
  query         text NOT NULL,           -- the actual prompt sent to LLMs

  display_order integer  NOT NULL DEFAULT 0,
  is_active     boolean  NOT NULL DEFAULT true,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT measurements_title_not_empty CHECK (char_length(title) > 0),
  CONSTRAINT measurements_query_not_empty CHECK (char_length(query) > 0),
  CONSTRAINT measurements_query_length    CHECK (char_length(query) <= 2000)
);

-- LLM providers — reference / lookup table
CREATE TABLE public.llm_providers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           varchar(100) NOT NULL UNIQUE,  -- internal key (e.g. "openai-gpt4o")
  display_name   varchar(255) NOT NULL,         -- shown in UI
  model_name     varchar(255),                  -- actual API model identifier
  is_active      boolean NOT NULL DEFAULT true,

  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. ANALYSIS
-- ============================================================================

-- One row per "Run Analysis" click, scoped to a single product
CREATE TABLE public.analysis_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  status                varchar(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- progress counters (UI polls these)
  total_measurements    integer NOT NULL DEFAULT 0,
  completed_measurements integer NOT NULL DEFAULT 0,
  total_llm_calls       integer NOT NULL DEFAULT 0,
  completed_llm_calls   integer NOT NULL DEFAULT 0,

  -- timing
  started_at            timestamptz,
  completed_at          timestamptz,
  duration_seconds      integer GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (completed_at - started_at))::integer
  ) STORED,

  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT analysis_runs_progress_valid CHECK (
    completed_measurements <= total_measurements
    AND completed_llm_calls <= total_llm_calls
  )
);

-- Raw LLM responses — 10 attempts × providers × measurements
CREATE TABLE public.ranking_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  uuid NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  measurement_id   uuid NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,
  llm_provider_id  uuid NOT NULL REFERENCES public.llm_providers(id) ON DELETE RESTRICT,

  attempt_number   integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 10),

  -- results
  raw_response           text,
  parsed_ranking         jsonb,     -- ordered list of product names
  target_product_rank    integer,   -- null = not found
  total_products_mentioned integer,

  -- meta
  success          boolean NOT NULL DEFAULT true,
  error_message    text,
  response_time_ms integer,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ranking_attempts_unique
    UNIQUE (analysis_run_id, measurement_id, llm_provider_id, attempt_number)
);

-- ============================================================================
-- 3. AGGREGATED RESULTS
-- ============================================================================

-- Pre-aggregated per measurement × provider × analysis_run
-- Populated by the analysis service after all 10 attempts complete.
-- This is the table the frontend reads from — never touches ranking_attempts directly.
CREATE TABLE public.competitor_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  uuid NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  measurement_id   uuid NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,

  -- the product/competitor being ranked
  product_name     text NOT NULL,
  is_target        boolean NOT NULL DEFAULT false,  -- true = user's own product

  -- aggregated metrics (across all attempts for all providers)
  average_rank     numeric(5,2),
  best_rank        integer,
  worst_rank       integer,
  appearances_count integer NOT NULL DEFAULT 0,
  total_attempts   integer NOT NULL DEFAULT 0,
  appearance_rate  numeric(5,2) NOT NULL DEFAULT 0,  -- 0-100
  weighted_score   numeric(5,2),

  -- per-provider breakdown
  llm_providers    text[] NOT NULL DEFAULT '{}',
  raw_ranks        integer[] NOT NULL DEFAULT '{}',

  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- companies
CREATE INDEX idx_companies_user_id ON public.companies(user_id);

-- products
CREATE INDEX idx_products_company_id     ON public.products(company_id);
CREATE INDEX idx_products_active         ON public.products(company_id) WHERE is_active = true;

-- measurements
CREATE INDEX idx_measurements_product_id ON public.measurements(product_id);
CREATE INDEX idx_measurements_active     ON public.measurements(product_id) WHERE is_active = true;

-- llm_providers
CREATE INDEX idx_llm_providers_active ON public.llm_providers(is_active) WHERE is_active = true;

-- analysis_runs
CREATE INDEX idx_analysis_runs_product    ON public.analysis_runs(product_id);
CREATE INDEX idx_analysis_runs_status     ON public.analysis_runs(product_id, status);
CREATE INDEX idx_analysis_runs_created    ON public.analysis_runs(product_id, created_at DESC);

-- ranking_attempts
CREATE INDEX idx_ranking_attempts_run       ON public.ranking_attempts(analysis_run_id);
CREATE INDEX idx_ranking_attempts_composite ON public.ranking_attempts(
  analysis_run_id, measurement_id, llm_provider_id
);

-- competitor_results  (most-queried table)
CREATE INDEX idx_competitor_results_run         ON public.competitor_results(analysis_run_id);
CREATE INDEX idx_competitor_results_measurement ON public.competitor_results(measurement_id);
CREATE INDEX idx_competitor_results_composite   ON public.competitor_results(
  measurement_id, analysis_run_id
);

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_companies_updated_at    BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_products_updated_at     BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_measurements_updated_at BEFORE UPDATE ON public.measurements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_attempts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_results     ENABLE ROW LEVEL SECURITY;

-- helper: "does this product belong to me?"
-- used by most policies below
CREATE OR REPLACE FUNCTION public.user_owns_product(p_product_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.companies c ON p.company_id = c.id
    WHERE p.id = p_product_id AND c.user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- companies ---------------------------------------------------------------
CREATE POLICY "companies_select" ON public.companies FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "companies_insert" ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "companies_update" ON public.companies FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "companies_delete" ON public.companies FOR DELETE
  USING (auth.uid() = user_id);

-- products ----------------------------------------------------------------
CREATE POLICY "products_select" ON public.products FOR SELECT
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
CREATE POLICY "products_insert" ON public.products FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
CREATE POLICY "products_update" ON public.products FOR UPDATE
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));
CREATE POLICY "products_delete" ON public.products FOR DELETE
  USING (company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()));

-- measurements ------------------------------------------------------------
CREATE POLICY "measurements_select" ON public.measurements FOR SELECT
  USING (public.user_owns_product(product_id));
CREATE POLICY "measurements_insert" ON public.measurements FOR INSERT
  WITH CHECK (public.user_owns_product(product_id));
CREATE POLICY "measurements_update" ON public.measurements FOR UPDATE
  USING (public.user_owns_product(product_id));
CREATE POLICY "measurements_delete" ON public.measurements FOR DELETE
  USING (public.user_owns_product(product_id));

-- analysis_runs -----------------------------------------------------------
CREATE POLICY "analysis_runs_select" ON public.analysis_runs FOR SELECT
  USING (public.user_owns_product(product_id));
CREATE POLICY "analysis_runs_insert" ON public.analysis_runs FOR INSERT
  WITH CHECK (public.user_owns_product(product_id));
CREATE POLICY "analysis_runs_update" ON public.analysis_runs FOR UPDATE
  USING (public.user_owns_product(product_id));

-- ranking_attempts --------------------------------------------------------
CREATE POLICY "ranking_attempts_select" ON public.ranking_attempts FOR SELECT
  USING (
    analysis_run_id IN (
      SELECT id FROM public.analysis_runs WHERE public.user_owns_product(product_id)
    )
  );
CREATE POLICY "ranking_attempts_insert" ON public.ranking_attempts FOR INSERT
  WITH CHECK (
    analysis_run_id IN (
      SELECT id FROM public.analysis_runs WHERE public.user_owns_product(product_id)
    )
  );

-- competitor_results ------------------------------------------------------
CREATE POLICY "competitor_results_select" ON public.competitor_results FOR SELECT
  USING (
    analysis_run_id IN (
      SELECT id FROM public.analysis_runs WHERE public.user_owns_product(product_id)
    )
  );
CREATE POLICY "competitor_results_insert" ON public.competitor_results FOR INSERT
  WITH CHECK (
    analysis_run_id IN (
      SELECT id FROM public.analysis_runs WHERE public.user_owns_product(product_id)
    )
  );
CREATE POLICY "competitor_results_delete" ON public.competitor_results FOR DELETE
  USING (
    analysis_run_id IN (
      SELECT id FROM public.analysis_runs WHERE public.user_owns_product(product_id)
    )
  );

-- llm_providers — public read-only (no RLS needed, no user data)
-- We still allow select for everyone
CREATE POLICY "llm_providers_public_read" ON public.llm_providers FOR SELECT
  USING (true);

-- ============================================================================
-- 7. SEED DATA
-- ============================================================================

INSERT INTO public.llm_providers (name, display_name, model_name, is_active) VALUES
  ('openai-gpt5-nano', 'GPT-5.2', 'gpt-5-nano', true),
  ('gemini-3-flash-preview', 'Gemini 3 Flash', 'gemini-3-flash-preview', true),
  ('gemini-3-pro-preview', 'Gemini 3 Pro', 'gemini-3-pro-preview', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- DONE
-- ============================================================================
