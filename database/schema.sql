-- RankLens Enhanced Database Schema
-- Run these commands in your Supabase SQL editor

-- Enable RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create businesses table (one business per user)
CREATE TABLE businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE, -- One business per user
  
  -- Google Maps API data
  google_place_id VARCHAR(255) UNIQUE NOT NULL, -- Unique Google Place ID
  name VARCHAR(255) NOT NULL, -- Business name from Google Maps API (displayName.text)
  city VARCHAR(100),
  
  -- Google category data
  google_primary_type VARCHAR(100), -- Machine-readable primary type (e.g., "restaurant")
  google_primary_type_display VARCHAR(150), -- Human-readable primary type (e.g., "Restaurant")
  google_types JSONB, -- Array of all Google types for this business
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create queries table (belongs directly to business)
CREATE TABLE queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create LLM providers table (public reference data)
CREATE TABLE llm_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  supports_sources BOOLEAN DEFAULT false, -- Whether this LLM provides source attribution
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analysis runs table (weekly analysis tracking)
CREATE TABLE analysis_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  total_queries INTEGER NOT NULL DEFAULT 0,
  completed_queries INTEGER DEFAULT 0,
  total_llm_calls INTEGER DEFAULT 0,
  completed_llm_calls INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ranking attempts table (individual LLM calls)
CREATE TABLE ranking_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  llm_provider_id UUID NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 5),
  raw_response TEXT, -- Store full LLM response
  parsed_ranking JSONB, -- Store extracted ranking list with business names and positions
  target_business_rank INTEGER, -- Rank of the user's business in this attempt (null if not found)
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sources table (attribution sources from LLMs when available)
CREATE TABLE ranking_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ranking_attempt_id UUID NOT NULL REFERENCES ranking_attempts(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL, -- Name of the business this source refers to
  rank_position INTEGER NOT NULL, -- Position this business held in the ranking
  source_url VARCHAR(1000),
  source_title VARCHAR(500),
  source_domain VARCHAR(255),
  source_type VARCHAR(100), -- 'review_site', 'directory', 'news', 'social', 'official_website', etc.
  excerpt TEXT,
  relevance_score DECIMAL(3,2), -- 0-1 relevance score if provided by LLM
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default LLM providers with source support info
INSERT INTO llm_providers (name, supports_sources, is_active) VALUES
('OpenAI GPT-4', false, true),
('Anthropic Claude', false, true),
('Google Gemini', false, true),
('Perplexity AI', true, true);

-- Enable Row Level Security on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- LLM providers: Public read access for all authenticated users
CREATE POLICY "LLM providers are readable by authenticated users" ON llm_providers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Businesses: Users can only access their own business
CREATE POLICY "Users can only access their own business" ON businesses
  FOR ALL USING (auth.uid() = user_id);

-- Queries: Users can only access queries from their business
CREATE POLICY "Users can only access queries from their business" ON queries
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Analysis runs: Users can only access runs from their business
CREATE POLICY "Users can only access analysis runs from their business" ON analysis_runs
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Ranking attempts: Users can only access attempts from their analysis runs
CREATE POLICY "Users can only access ranking attempts from their runs" ON ranking_attempts
  FOR ALL USING (
    analysis_run_id IN (
      SELECT ar.id FROM analysis_runs ar
      JOIN businesses b ON ar.business_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

-- Ranking sources: Users can only access sources from their ranking attempts
CREATE POLICY "Users can only access ranking sources from their attempts" ON ranking_sources
  FOR ALL USING (
    ranking_attempt_id IN (
      SELECT ra.id FROM ranking_attempts ra
      JOIN analysis_runs ar ON ra.analysis_run_id = ar.id
      JOIN businesses b ON ar.business_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_businesses_google_place_id ON businesses(google_place_id);
CREATE INDEX idx_businesses_user_id ON businesses(user_id);
CREATE INDEX idx_businesses_google_primary_type ON businesses(google_primary_type);
CREATE INDEX idx_businesses_city ON businesses(city);
CREATE INDEX idx_businesses_name ON businesses(name);
CREATE INDEX idx_queries_business_id ON queries(business_id);
CREATE INDEX idx_analysis_runs_business_id ON analysis_runs(business_id);
CREATE INDEX idx_analysis_runs_date ON analysis_runs(run_date);
CREATE INDEX idx_analysis_runs_status ON analysis_runs(status);
CREATE INDEX idx_ranking_attempts_analysis_run_id ON ranking_attempts(analysis_run_id);
CREATE INDEX idx_ranking_attempts_query_llm ON ranking_attempts(query_id, llm_provider_id);
CREATE INDEX idx_ranking_attempts_target_rank ON ranking_attempts(target_business_rank);
CREATE INDEX idx_ranking_sources_attempt_id ON ranking_sources(ranking_attempt_id);
CREATE INDEX idx_ranking_sources_business_name ON ranking_sources(business_name);
CREATE INDEX idx_ranking_sources_domain ON ranking_sources(source_domain);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE
  ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
