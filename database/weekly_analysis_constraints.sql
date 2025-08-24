-- Add unique constraint to ensure only one analysis run per business per week
-- We'll use the start of the week (Monday) as the reference point
ALTER TABLE public.analysis_runs 
ADD COLUMN week_start_date date GENERATED ALWAYS AS (
  run_date - INTERVAL '1 day' * EXTRACT(DOW FROM run_date)::integer + INTERVAL '1 day'
) STORED;

-- Create unique constraint for one analysis per business per week
ALTER TABLE public.analysis_runs 
ADD CONSTRAINT analysis_runs_business_week_unique 
UNIQUE (business_id, week_start_date);

-- Add index for better performance on weekly queries
CREATE INDEX idx_analysis_runs_business_week 
ON public.analysis_runs (business_id, week_start_date DESC);

-- Add index for querying runs by status and date
CREATE INDEX idx_analysis_runs_status_date 
ON public.analysis_runs (business_id, status, run_date DESC);

-- Optional: Add a function to get the start of week for a given date
CREATE OR REPLACE FUNCTION get_week_start(input_date date)
RETURNS date AS $$
BEGIN
  RETURN input_date - INTERVAL '1 day' * EXTRACT(DOW FROM input_date)::integer + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
