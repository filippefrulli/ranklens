// Core data models for RankLens

export interface Business {
  id: string
  user_id: string
  name: string
  city?: string
  google_place_id: string
  google_primary_type?: string
  google_primary_type_display?: string
  google_types?: string[]
  created_at: string
  updated_at: string
}

export interface Query {
  id: string
  business_id: string  // Updated to reference business instead of project
  text: string
  order_index: number
  created_at: string
}

export interface LLMProvider {
  id: string
  name: string
  supports_sources: boolean
  is_active: boolean
}

export interface AnalysisRun {
  id: string
  business_id: string
  run_date: string
  week_start_date?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  total_queries: number
  completed_queries: number
  total_llm_calls: number
  completed_llm_calls: number
  error_message?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

// Weekly analysis check result
export interface WeeklyAnalysisCheck {
  canRun: boolean
  lastRunDate?: string
  nextAllowedDate?: string
  currentWeekRun?: AnalysisRun
}

export interface RankingAttempt {
  id: string
  analysis_run_id: string
  query_id: string
  llm_provider_id: string
  attempt_number: number // 1-5 for each query
  raw_response?: string
  parsed_ranking: string[] // JSON array of business names in order
  target_business_rank?: number // null if business not found in results
  success: boolean
  error_message?: string
  created_at: string
}

export interface RankingSource {
  id: string
  ranking_attempt_id: string
  business_name: string
  rank_position: number
  source_url?: string
  source_title?: string
  source_domain?: string
  source_type?: string
  excerpt?: string
  relevance_score?: number
  created_at: string
}

// Keep the old RankingResult interface for backward compatibility
export interface RankingResult {
  id: string
  query_id: string
  llm_provider_id: string
  attempt_number: number
  ranked_businesses: string[]
  target_business_rank?: number
  response_time_ms: number
  created_at: string
}

export interface RankingAnalytics {
  query_id: string
  query_text: string
  average_rank?: number
  total_mentions: number
  llm_breakdown: {
    provider_name: string
    average_rank?: number
    mention_count: number
    best_rank?: number
    worst_rank?: number
  }[]
  competitors_ranked_higher: {
    business_name: string
    average_rank: number
    mention_count: number
  }[]
}

export interface QueryRankingHistory {
  run_date: string
  analysis_run_id: string
  average_rank: number | null
  best_rank: number | null
  worst_rank: number | null
  total_attempts: number
  successful_attempts: number
}

export interface DashboardData {
  business: Business
  queries: Query[]
  analytics: RankingAnalytics[]
  overall_stats: {
    total_queries: number
    total_llm_calls: number
    overall_average_rank?: number
    total_mentions: number
  }
}
