-- ============================================================================
-- Migration: Add source_citations table
-- Stores online sources discovered via LLM grounding for products in each run
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.source_citations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  uuid NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  measurement_id   uuid NOT NULL REFERENCES public.measurements(id) ON DELETE CASCADE,

  product_name     text NOT NULL,
  is_target        boolean NOT NULL DEFAULT false,

  url              text,
  title            text,
  snippet          text,   -- brief context from the LLM response

  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_source_citations_run_measurement
  ON public.source_citations(analysis_run_id, measurement_id);

CREATE INDEX IF NOT EXISTS idx_source_citations_product
  ON public.source_citations(analysis_run_id, product_name);

-- RLS
ALTER TABLE public.source_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "source_citations_select" ON public.source_citations FOR SELECT
  USING (
    analysis_run_id IN (
      SELECT id FROM public.analysis_runs WHERE public.user_owns_product(product_id)
    )
  );

CREATE POLICY "source_citations_insert" ON public.source_citations FOR INSERT
  WITH CHECK (
    analysis_run_id IN (
      SELECT id FROM public.analysis_runs WHERE public.user_owns_product(product_id)
    )
  );

CREATE POLICY "source_citations_delete" ON public.source_citations FOR DELETE
  USING (
    analysis_run_id IN (
      SELECT id FROM public.analysis_runs WHERE public.user_owns_product(product_id)
    )
  );
