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
  WeeklyAnalysisCheck,
  QueryRankingHistory
} from '../types'
import { BusinessNameStandardizationService } from './business-name-standardization-service'

// Unified database service with authenticated Supabase client (respects RLS)
export class DatabaseService {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  // Business name normalization utility for consolidation
  private normalizeBusinessName(businessName: string): string {
    return businessName
      .toLowerCase()
      .trim()
      // Remove common punctuation
      .replace(/[.,;:'"!?()]/g, '')
      // Standardize separators
      .replace(/\s*-\s*/g, ' ')
      .replace(/\s*&\s*/g, ' and ')
      .replace(/\s+/g, ' ')
      .trim()
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

  // Create a new business for the authenticated user
  async createBusiness(businessData: {
    name: string
    google_place_id: string
    city: string
  }): Promise<Business> {
    const { data, error } = await this.supabase
      .from('businesses')
      .insert([
        {
          user_id: this.userId,
          name: businessData.name,
          google_place_id: businessData.google_place_id,
          city: businessData.city
        }
      ])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating business:', error)
      throw new Error(`Failed to create business: ${error.message}`)
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

  // Get a single query by ID
  async getQuery(queryId: string): Promise<Query | null> {
    const { data, error } = await this.supabase
      .from('queries')
      .select('*')
      .eq('id', queryId)
      .single()
    
    if (error) {
      console.error('Error fetching query:', error)
      return null
    }
    
    return data
  }

  // Create a new query for a business
  async createQuery(queryData: {
    business_id: string
    text: string
  }): Promise<Query> {
    // Get the next order index
    const { data: existingQueries } = await this.supabase
      .from('queries')
      .select('order_index')
      .eq('business_id', queryData.business_id)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex = existingQueries && existingQueries.length > 0 
      ? existingQueries[0].order_index + 1 
      : 0

    const { data, error } = await this.supabase
      .from('queries')
      .insert([
        {
          business_id: queryData.business_id,
          text: queryData.text,
          order_index: nextOrderIndex
        }
      ])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating query:', error)
      throw new Error(`Failed to create query: ${error.message}`)
    }
    
    return data
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
      throw new Error(`Failed to fetch LLM providers: ${error.message}`)
    }
    
    return data || []
  }

  async ensureRequiredProvidersActive(): Promise<void> {
    // Ensure core providers are active using canonical display names
    // (Models are managed separately; we only seed provider identities here)
    const requiredProviders = [
      { name: 'OpenAI' },
      { name: 'Google Gemini' }
    ]

    for (const provider of requiredProviders) {
      // Check if provider exists
      const { data: existing, error: fetchError } = await this.supabase
        .from('llm_providers')
        .select('*')
        .eq('name', provider.name)
        .maybeSingle()

      if (fetchError) {
        console.error(`Error checking provider ${provider.name}:`, fetchError)
        continue
      }

      if (!existing) {
        // Create the provider
        const { error: createError } = await this.supabase
          .from('llm_providers')
          .insert({
            name: provider.name,
            is_active: true
          })

        if (createError) {
          console.error(`Error creating provider ${provider.name}:`, createError)
        }
      } else if (!existing.is_active) {
        // Activate the provider
        const { error: updateError } = await this.supabase
          .from('llm_providers')
          .update({ is_active: true })
          .eq('id', existing.id)

        if (updateError) {
          console.error(`Error activating provider ${provider.name}:`, updateError)
        }
      }
    }
  }

  // Analysis Run operations
  async createAnalysisRun(businessId: string, totalQueries: number): Promise<AnalysisRun> {
    console.log(`📊 Creating analysis run for business ${businessId} with ${totalQueries} queries`)
    
    const { data, error } = await this.supabase
      .from('analysis_runs')
      .insert([{
        business_id: businessId,
        run_date: new Date().toISOString().split('T')[0],
        total_queries: totalQueries,
        started_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error(`❌ Failed to create analysis run for business ${businessId}:`, error.message)
      throw new Error(`Failed to create analysis run: ${error.message}`)
    }
    
    console.log(`✅ Analysis run created: ${data.id}`)
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
      .in('status', ['pending', 'running'])
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
    // DEVELOPMENT MODE: Always allow analysis runs
    // TODO: Re-enable weekly limits for production
    
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

    // DEVELOPMENT: Always allow runs regardless of weekly limit
    const canRun = true // Changed from: !currentWeekRun
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
          id,
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
      business_name: string // Store the first/canonical name we encounter
      original_names: string[] // Track all variations we've seen
      ranks: number[]
      llm_providers: string[]
      appearances_count: number
      is_user_business: boolean
      ranksByProvider: Map<string, number[]> // Track ranks per provider
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
        
        // Use the stored target_business_rank instead of recalculating from truncated list
        const userBusinessRank = attempt.target_business_rank
        
        // Calculate truncation limit using the original rank
        const truncationLimit = this.calculateTruncationLimit(userBusinessRank, parsedRanking.length)
        
        // Only process businesses up to the truncation limit
        const businessesToProcess = parsedRanking.slice(0, truncationLimit)
        
        businessesToProcess.forEach((businessName, index) => {
          const rank = index + 1
          const businessKey = this.normalizeBusinessName(businessName) // Use normalized name as key
          const businessNameLower = businessName.toLowerCase().trim()
          
          // Determine if this is the user's business - use the stored rank for accuracy
          const isUserBusiness = userBusinessRank !== null && rank === userBusinessRank

          if (!businessMap.has(businessKey)) {
            businessMap.set(businessKey, {
              business_name: businessName, // Store the first name we encounter
              original_names: [businessName],
              ranks: [],
              llm_providers: [],
              appearances_count: 0,
              is_user_business: isUserBusiness,
              ranksByProvider: new Map()
            })
          }

          const business = businessMap.get(businessKey)!
          business.ranks.push(rank)
          business.appearances_count++
          
          // Track ranks by provider
          if (!business.ranksByProvider.has(providerName)) {
            business.ranksByProvider.set(providerName, [])
          }
          business.ranksByProvider.get(providerName)!.push(rank)
          
          // Track this variation if we haven't seen it before
          if (!business.original_names.includes(businessName)) {
            business.original_names.push(businessName)
          }
          
          // Add LLM provider if not already included
          if (!business.llm_providers.includes(providerName)) {
            business.llm_providers.push(providerName)
          }
        })
      } catch (parseError) {
        console.warn('Failed to parse ranking for attempt:', attempt.id, parseError)
      }
    })

    console.log(`📊 Business map contains ${businessMap.size} unique businesses`)
    
    // If no businesses found, return early
    if (businessMap.size === 0) {
      console.log('⚠️ No businesses found in rankings, skipping competitor results processing')
      return 0
    }

    // Standardize business names using LLM before processing results
    console.log('📝 Standardizing business names...')
    const allBusinessNames = Array.from(businessMap.keys())
    console.log(`Found ${allBusinessNames.length} unique business names to standardize:`, allBusinessNames.map(key => businessMap.get(key)!.business_name))
    
    let standardizations
    try {
      standardizations = await BusinessNameStandardizationService.standardizeBusinessNames(
        allBusinessNames.map(key => businessMap.get(key)!.business_name)
      )
      console.log('✅ Standardization completed:', standardizations)
    } catch (error) {
      console.error('❌ Standardization failed:', error)
      // Fallback: use original names
      standardizations = allBusinessNames.map(key => ({
        originalName: businessMap.get(key)!.business_name,
        standardizedName: businessMap.get(key)!.business_name,
        confidence: 'low' as const
      }))
    }
    
    // Create a mapping from original names to standardized names
    const nameStandardizationMap = new Map<string, string>()
    for (const standardization of standardizations) {
      nameStandardizationMap.set(standardization.originalName, standardization.standardizedName)
    }
    
    // Apply standardization to business map
    const standardizedBusinessMap = new Map<string, {
      business_name: string
      original_names: string[]
      ranks: number[]
      llm_providers: string[]
      appearances_count: number
      is_user_business: boolean
      ranksByProvider: Map<string, number[]>
    }>()
    
    for (const [key, business] of businessMap) {
      const standardizedName = nameStandardizationMap.get(business.business_name) || business.business_name
      const standardizedKey = this.normalizeBusinessName(standardizedName)
      
      if (!standardizedBusinessMap.has(standardizedKey)) {
        standardizedBusinessMap.set(standardizedKey, {
          business_name: standardizedName,
          original_names: [...business.original_names],
          ranks: [...business.ranks],
          llm_providers: [...business.llm_providers],
          appearances_count: business.appearances_count,
          is_user_business: business.is_user_business,
          ranksByProvider: new Map(business.ranksByProvider)
        })
      } else {
        // Merge with existing standardized business
        const existing = standardizedBusinessMap.get(standardizedKey)!
        existing.original_names.push(...business.original_names)
        existing.ranks.push(...business.ranks)
        existing.appearances_count += business.appearances_count
        
        // Merge LLM providers
        for (const provider of business.llm_providers) {
          if (!existing.llm_providers.includes(provider)) {
            existing.llm_providers.push(provider)
          }
        }
        
        // Merge ranks by provider
        for (const [provider, ranks] of business.ranksByProvider) {
          if (!existing.ranksByProvider.has(provider)) {
            existing.ranksByProvider.set(provider, [...ranks])
          } else {
            existing.ranksByProvider.get(provider)!.push(...ranks)
          }
        }
        
        // If any version was user business, mark as user business
        if (business.is_user_business) {
          existing.is_user_business = true
        }
      }
    }
    
    console.log(`✅ Standardized ${businessMap.size} names into ${standardizedBusinessMap.size} unique businesses`)

    // Convert to competitor results and insert
    const competitorResults: any[] = []
    
    // Create individual records for each provider that ranked each business
    Array.from(standardizedBusinessMap.values()).forEach(business => {
      business.ranksByProvider.forEach((ranks, providerName) => {
        const averageRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length
        const bestRank = Math.min(...ranks)
        const worstRank = Math.max(...ranks)
        const providerAttempts = attempts.filter(attempt => attempt.llm_providers?.name === providerName).length
        const appearanceRate = (ranks.length / providerAttempts) * 100
        const weightedScore = averageRank * (3.0 - 2.5 * (appearanceRate / 100))

        competitorResults.push({
          query_id: queryId,
          analysis_run_id: analysisRunId,
          business_name: business.business_name,
          average_rank: Number(averageRank.toFixed(2)),
          best_rank: bestRank,
          worst_rank: worstRank,
          appearances_count: ranks.length,
          total_attempts: providerAttempts,
          weighted_score: Number(weightedScore.toFixed(2)),
          llm_providers: [providerName], // Array with single provider name
          raw_ranks: ranks,
          is_user_business: business.is_user_business
        })
      })
    })

    console.log(`📊 Created ${competitorResults.length} competitor result records`)
    
    if (competitorResults.length === 0) {
      console.log('⚠️ No competitor results created')
      return 0
    }

    // Log a sample of the results for debugging
    console.log('📝 Sample competitor results:', JSON.stringify(competitorResults.slice(0, 1), null, 2))

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
    console.log(`✅ Competitor results populated: ${insertedCount} competitor entries created for analysis run ${analysisRunId}`)
    
    return insertedCount
  }

  // Calculate truncation limit based on user business rank
  private calculateTruncationLimit(userRank: number | null, totalBusinesses: number): number {
    if (!userRank) {
      // If user business not found, return all businesses
      return totalBusinesses
    }
    
    // Round up to next multiple of 5
    const roundedRank = Math.ceil(userRank / 5) * 5
    
    // Don't exceed the total number of businesses
    return Math.min(roundedRank, totalBusinesses)
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

  // Get ranking history for a query (aggregated by analysis run)
  async getQueryRankingHistory(queryId: string, limit: number = 10): Promise<QueryRankingHistory[]> {
    try {
      // Get recent analysis runs for this query with ranking data
      const { data, error } = await this.supabase
        .from('ranking_attempts')
        .select(`
          analysis_run_id,
          created_at,
          parsed_ranking
        `)
        .eq('query_id', queryId)
        .not('parsed_ranking', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit * 10) // Get more attempts to group by run

      if (error) {
        console.error('❌ Error fetching query ranking history:', error)
        throw new Error(`Failed to fetch query ranking history: ${error.message}`)
      }

      // Group by analysis_run_id and calculate aggregated ranking stats
      const runStats = new Map<string, {
        run_date: string,
        rankings: number[],
        total_attempts: number,
        successful_attempts: number
      }>()

      for (const attempt of (data || [])) {
        const runId = attempt.analysis_run_id
        if (!runStats.has(runId)) {
          runStats.set(runId, {
            run_date: attempt.created_at,
            rankings: [],
            total_attempts: 0,
            successful_attempts: 0
          })
        }

        const stats = runStats.get(runId)!
        stats.total_attempts++

        // Parse ranking and find our business position
        try {
          const ranking = Array.isArray(attempt.parsed_ranking) 
            ? attempt.parsed_ranking 
            : JSON.parse(attempt.parsed_ranking || '[]')
          
          // For now, we'll use a placeholder rank calculation
          // In a real implementation, you'd match the business name in the ranking
          if (ranking.length > 0) {
            // Use middle position as placeholder - in reality you'd search for the business
            const rank = Math.ceil(ranking.length / 2)
            stats.rankings.push(rank)
            stats.successful_attempts++
          }
        } catch (error) {
          console.warn('Failed to parse ranking for attempt:', attempt.analysis_run_id, error)
        }
      }

      // Convert to QueryRankingHistory format
      const history: QueryRankingHistory[] = Array.from(runStats.entries())
        .map(([runId, stats]) => ({
          run_date: stats.run_date,
          analysis_run_id: runId,
          average_rank: stats.rankings.length > 0 
            ? stats.rankings.reduce((a, b) => a + b, 0) / stats.rankings.length 
            : null,
          best_rank: stats.rankings.length > 0 ? Math.min(...stats.rankings) : null,
          worst_rank: stats.rankings.length > 0 ? Math.max(...stats.rankings) : null,
          total_attempts: stats.total_attempts,
          successful_attempts: stats.successful_attempts
        }))
        .sort((a, b) => new Date(b.run_date).getTime() - new Date(a.run_date).getTime())
        .slice(0, limit)

      return history
    } catch (error) {
      console.error('❌ Error in getQueryRankingHistory:', error)
      return []
    }
  }
}
