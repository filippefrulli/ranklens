-- RankLens Database Schema
-- Run these commands in your Supabase SQL editor

-- Enable RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  location VARCHAR(255),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create queries table
CREATE TABLE queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create LLM providers table
CREATE TABLE llm_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  api_endpoint VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ranking results table
CREATE TABLE ranking_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  llm_provider_id UUID NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 5),
  ranked_businesses JSONB NOT NULL,
  target_business_rank INTEGER,
  response_time_ms INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default LLM providers
INSERT INTO llm_providers (name, api_endpoint, is_active) VALUES
('OpenAI GPT-4', 'https://api.openai.com/v1/chat/completions', true),
('Anthropic Claude', 'https://api.anthropic.com/v1/messages', true),
('Google Gemini', 'https://generativelanguage.googleapis.com/v1/models', true),
('Cohere Command', 'https://api.cohere.ai/v1/generate', true),
('Perplexity AI', 'https://api.perplexity.ai/chat/completions', true);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only access their own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access queries from their projects" ON queries
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can only access ranking results from their queries" ON ranking_results
  FOR ALL USING (
    query_id IN (
      SELECT q.id FROM queries q
      JOIN projects p ON q.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- LLM providers are readable by all authenticated users
CREATE POLICY "LLM providers are readable by authenticated users" ON llm_providers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create indexes for better performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_queries_project_id ON queries(project_id);
CREATE INDEX idx_ranking_results_query_id ON ranking_results(query_id);
CREATE INDEX idx_ranking_results_llm_provider_id ON ranking_results(llm_provider_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to projects table
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE
  ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
