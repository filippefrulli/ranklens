-- Migration: add measurement_id to analysis_runs
-- analysis_runs were originally product-scoped but are only ever created for a single measurement.
-- Adding measurement_id makes status checks measurement-specific.

ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS measurement_id uuid REFERENCES public.measurements(id) ON DELETE CASCADE;

-- Index for efficient per-measurement status lookups
CREATE INDEX IF NOT EXISTS idx_analysis_runs_measurement
  ON public.analysis_runs(measurement_id, status);
