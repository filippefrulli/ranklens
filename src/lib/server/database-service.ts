import { createClient } from '@supabase/supabase-js'
import { env } from '$env/dynamic/private'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { 
  Business, 
  Query, 
  LLMProvider, 
  AnalysisRun, 
  RankingAttempt,
  CompetitorResult,
  WeeklyAnalysisCheck 
} from '../types'

// Server-only database service with authenticated Supabase client (respects RLS)
export class ServerDatabaseService {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  // Create authenticated instance
  static createAuthenticatedClient(accessToken: string): SupabaseClient {
    const supabaseUrl = env.VITE_SUPABASE_URL
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing')
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    })
    
    return supabase
  }

  // Business operations (with RLS)
  async getBusiness(): Promise<Business | null> {
    const { data, error } = await this.supabase
      .from('businesses')
      .select('*')
      .eq('user_id', this.userId) // RLS will also enforce this
      .single()
    
    if (error) {
      console.error('Error fetching business:', error)
      return null
    }
    
    return data
  }

  // Validate business ownership (RLS will enforce this automatically)
  async validateBusinessOwnership(businessId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('businesses')
      .select('user_id')
      .eq('id', businessId)
      .single()
    
    if (error || !data) {
      return false
    }
    
    return data.user_id === this.userId
  }

  // Query operations
  async getQueriesForBusiness(businessId: string): Promise<Query[]> {
    const { data, error } = await this.supabase
      .from('queries')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Error fetching queries:', error)
      return []
    }
    
    return data || []
  }

  // LLM Provider operations
  async getActiveLLMProviders(): Promise<LLMProvider[]> {
    const { data, error } = await this.supabase
      .from('llm_providers')
      .select('*')
      .eq('is_active', true)
      .order('name')
    
    if (error) {
      console.error('Error fetching LLM providers:', error)
      return []
    }
    
    return data || []
  }

  // Analysis Run operations
  async createAnalysisRun(businessId: string, totalQueries: number): Promise<AnalysisRun> {
    const { data, error } = await this.supabase
      .from('analysis_runs')
      .insert([{
        business_id: businessId,
        run_date: new Date().toISOString().split('T')[0],
        status: 'running',
        total_queries: totalQueries,
        completed_queries: 0,
        total_llm_calls: totalQueries * 5, // Estimate: 5 attempts per query per active provider
        completed_llm_calls: 0,
        started_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create analysis run: ${error.message}`)
    }
    
    return data
  }

  async updateAnalysisRun(id: string, updates: Partial<AnalysisRun>): Promise<AnalysisRun> {
    const { data, error } = await this.supabase
      .from('analysis_runs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update analysis run: ${error.message}`)
    }
    
    return data
  }

  async getRunningAnalysisForBusiness(businessId: string): Promise<AnalysisRun | null> {
    const { data, error } = await this.supabase
      .from('analysis_runs')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching running analysis:', error)
      return null
    }
    
    return data
  }

  // Ranking Attempts operations
  async saveRankingAttempts(attempts: Omit<RankingAttempt, 'id' | 'created_at'>[]): Promise<void> {
    const { error } = await this.supabase
      .from('ranking_attempts')
      .insert(attempts)

    if (error) {
      throw new Error(`Failed to save ranking attempts: ${error.message}`)
    }
  }

  // Weekly analysis check
  async checkWeeklyAnalysis(businessId: string): Promise<WeeklyAnalysisCheck> {
    // Get the start of current week (Monday)
    const now = new Date()
    const currentWeekStart = new Date(now)
    currentWeekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
    currentWeekStart.setHours(0, 0, 0, 0)
    
    const { data: currentWeekRun, error } = await this.supabase
      .from('analysis_runs')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', currentWeekStart.toISOString())
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error checking weekly analysis:', error)
    }

    const canRun = !currentWeekRun
    const nextWeekStart = new Date(currentWeekStart)
    nextWeekStart.setDate(currentWeekStart.getDate() + 7)

    return {
      canRun,
      lastRunDate: currentWeekRun?.created_at,
      nextAllowedDate: canRun ? undefined : nextWeekStart.toISOString(),
      currentWeekRun: currentWeekRun || undefined
    }
  }

  // Competitor Results operations
  async populateCompetitorResultsForAnalysisRun(analysisRunId: string): Promise<number> {
    
    // Get all unique queries for this analysis run
    const { data: queryIds, error: queryError } = await this.supabase
      .from('ranking_attempts')
      .select('query_id')
      .eq('analysis_run_id', analysisRunId)
      .not('query_id', 'is', null)

    if (queryError) {
      console.error('❌ Error fetching query IDs:', queryError)
      throw new Error(`Failed to fetch query IDs: ${queryError.message}`)
    }

    if (!queryIds || queryIds.length === 0) {
      return 0
    }

    // Get unique query IDs
    const uniqueQueryIds = [...new Set(queryIds.map(q => q.query_id))]

    let totalInserted = 0
    for (const queryId of uniqueQueryIds) {
      try {
        const inserted = await this.populateCompetitorResultsForQuery(queryId, analysisRunId)
        totalInserted += inserted
      } catch (error) {
        console.error(`❌ Error populating results for query ${queryId}:`, error)
        // Continue with other queries even if one fails
      }
    }

    console.log(`✅ Total competitor results populated: ${totalInserted}`)
    return totalInserted
  }

  async populateCompetitorResultsForQuery(queryId: string, analysisRunId: string): Promise<number> {
    // Get the user's business name for this query
    const { data: queryData, error: queryError } = await this.supabase
      .from('queries')
      .select(`
        *,
        businesses!inner(
          name
        )
      `)
      .eq('id', queryId)
      .single()

    if (queryError) {
      throw new Error(`Failed to fetch query data: ${queryError.message}`)
    }

    const userBusinessName = queryData.businesses.name.toLowerCase().trim()

    // Get ALL ranking attempts for this query and run that have parsed_ranking data
    // This includes both successful and unsuccessful attempts (business not found)
    const { data: attempts, error: attemptsError } = await this.supabase
      .from('ranking_attempts')
      .select(`
        *,
        llm_providers!inner(
          name
        )
      `)
      .eq('query_id', queryId)
      .eq('analysis_run_id', analysisRunId)
      .not('parsed_ranking', 'is', null)

    if (attemptsError) {
      throw new Error(`Failed to fetch ranking attempts: ${attemptsError.message}`)
    }

    if (!attempts || attempts.length === 0) {
      return 0
    }

    // Clear existing results for this query/run
    const { error: deleteError } = await this.supabase
      .from('competitor_results')
      .delete()
      .eq('query_id', queryId)
      .eq('analysis_run_id', analysisRunId)

    if (deleteError) {
      console.warn('⚠️ Error clearing existing results:', deleteError)
    }

    // Process all businesses mentioned in rankings
    const businessMap = new Map<string, {
      business_name: string
      ranks: number[]
      llm_providers: string[]
      appearances_count: number
      is_user_business: boolean
    }>()

    // Extract businesses from all attempts
    attempts.forEach(attempt => {
      try {
        let parsedRanking: string[]
        
        // Handle both cases: string that needs parsing or already an array
        if (typeof attempt.parsed_ranking === 'string') {
          parsedRanking = JSON.parse(attempt.parsed_ranking)
        } else if (Array.isArray(attempt.parsed_ranking)) {
          parsedRanking = attempt.parsed_ranking
        } else {
          console.warn('❌ Invalid parsed_ranking format for attempt:', attempt.id)
          return
        }

        if (!Array.isArray(parsedRanking)) {
          console.warn('❌ parsed_ranking is not an array for attempt:', attempt.id)
          return
        }

        const providerName = attempt.llm_providers?.name || 'Unknown'
        
        parsedRanking.forEach((businessName, index) => {
          const rank = index + 1
          const businessKey = businessName.trim()
          const businessNameLower = businessName.toLowerCase().trim()
          
          // Determine if this is the user's business
          const isUserBusiness = businessNameLower === userBusinessName || 
                                businessNameLower.includes(userBusinessName) ||
                                userBusinessName.includes(businessNameLower)

          if (!businessMap.has(businessKey)) {
            businessMap.set(businessKey, {
              business_name: businessName,
              ranks: [],
              llm_providers: [],
              appearances_count: 0,
              is_user_business: isUserBusiness
            })
          }

          const business = businessMap.get(businessKey)!
          business.ranks.push(rank)
          business.appearances_count++
          
          // Add LLM provider if not already included
          if (!business.llm_providers.includes(providerName)) {
            business.llm_providers.push(providerName)
          }
        })
      } catch (parseError) {
        console.warn('Failed to parse ranking for attempt:', attempt.id, parseError)
      }
    })

    // Convert to competitor results and insert
    const competitorResults = Array.from(businessMap.values()).map(business => {
      const averageRank = business.ranks.reduce((sum, rank) => sum + rank, 0) / business.ranks.length
      const bestRank = Math.min(...business.ranks)
      const worstRank = Math.max(...business.ranks)
      const appearanceRate = (business.appearances_count / attempts.length) * 100
      const weightedScore = averageRank * (2.0 - (appearanceRate / 100))

      return {
        query_id: queryId,
        analysis_run_id: analysisRunId,
        business_name: business.business_name,
        average_rank: Number(averageRank.toFixed(2)),
        best_rank: bestRank,
        worst_rank: worstRank,
        appearances_count: business.appearances_count,
        total_attempts: attempts.length,
        // appearance_rate is a generated column - don't include it in insert
        weighted_score: Number(weightedScore.toFixed(2)),
        llm_providers: business.llm_providers,
        raw_ranks: business.ranks,
        is_user_business: business.is_user_business
      }
    })

    if (competitorResults.length === 0) {
      return 0
    }

    // Insert all competitor results
    const { data: insertedData, error: insertError } = await this.supabase
      .from('competitor_results')
      .insert(competitorResults)
      .select('id')

    if (insertError) {
      console.error('❌ Error inserting competitor results:', insertError)
      throw new Error(`Failed to insert competitor results: ${insertError.message}`)
    }

    const insertedCount = insertedData?.length || 0
    console.log(`✅ Inserted ${insertedCount} competitor results for query`)
    
    return insertedCount
  }

  // Get competitor results for a query/run
  async getCompetitorResults(queryId: string, analysisRunId: string): Promise<CompetitorResult[]> {
    const { data, error } = await this.supabase
      .from('competitor_results')
      .select('*')
      .eq('query_id', queryId)
      .eq('analysis_run_id', analysisRunId)
      .order('weighted_score', { ascending: true })

    if (error) {
      console.error('❌ Error fetching competitor results:', error)
      throw new Error(`Failed to fetch competitor results: ${error.message}`)
    }

    return data || []
  }
}
