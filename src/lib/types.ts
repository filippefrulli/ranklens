// Core data models for RankLens (v2 — product-based schema)

export interface Company {
  id: string
  user_id: string
  name: string
  google_place_id?: string
  google_primary_type?: string
  google_primary_type_display?: string
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  company_id: string
  name: string
  description?: string
  image_url?: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Measurement {
  id: string
  product_id: string
  title: string
  query: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LLMProvider {
  id: string
  name: string
  display_name: string
  model_name?: string
  is_active: boolean
  created_at: string
}

export interface AnalysisRun {
  id: string
  product_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  total_measurements: number
  completed_measurements: number
  total_llm_calls: number
  completed_llm_calls: number
  started_at?: string
  completed_at?: string
  duration_seconds?: number
  error_message?: string
  created_at: string
}

export interface RankingAttempt {
  id: string
  analysis_run_id: string
  measurement_id: string
  llm_provider_id: string
  attempt_number: number // 1-10
  raw_response?: string
  parsed_ranking: string[] // ordered list of product names
  target_product_rank?: number // null if not found
  total_products_mentioned?: number
  success: boolean
  error_message?: string
  response_time_ms?: number
  created_at: string
}

export interface CompetitorResult {
  id: string
  analysis_run_id: string
  measurement_id: string
  product_name: string
  is_target: boolean
  average_rank: number
  best_rank: number
  worst_rank: number
  appearances_count: number
  total_attempts: number
  appearance_rate: number
  weighted_score: number
  llm_providers: string[]
  raw_ranks: number[]
  created_at: string
}

// Composite types for UI

export interface MeasurementRankingHistory {
  analysis_run_id: string
  created_at: string
  average_rank: number | null
  best_rank: number | null
  worst_rank: number | null
  total_attempts: number
  successful_attempts: number
  provider_breakdown: {
    provider_id: string
    provider_name: string
    average_rank: number | null
  }[]
}

export interface RankingAnalytics {
  measurement_id: string
  measurement_title: string
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
    product_name: string
    average_rank: number
    mention_count: number
  }[]
}

export interface DashboardData {
  company: Company
  product: Product
  measurements: Measurement[]
  analytics: RankingAnalytics[]
  overall_stats: {
    total_measurements: number
    total_llm_calls: number
    overall_average_rank?: number
    total_mentions: number
  }
}

export interface SourceCitation {
  id: string
  analysis_run_id: string
  measurement_id: string
  product_name: string
  is_target: boolean
  url?: string
  title?: string
  snippet?: string
  created_at: string
}

export interface QuerySuggestion {
  text: string
  reasoning?: string
  accepted?: boolean
  rejected?: boolean
}
