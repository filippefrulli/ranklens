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

export interface Project {
  id: string
  name: string
  business_name: string
  industry?: string
  location?: string
  user_id: string
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
  api_endpoint: string
  is_active: boolean
}

export interface RankingResult {
  id: string
  query_id: string
  llm_provider_id: string
  attempt_number: number // 1-5 for each query
  ranked_businesses: string[] // JSON array of business names in order
  target_business_rank?: number // null if business not found in results
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
