import { supabase } from '../supabase'
import type { 
  Business,
  Query, 
  LLMProvider, 
  AnalysisRun,
  RankingAttempt,
  RankingSource,
  RankingResult, 
  RankingAnalytics,
  DashboardData 
} from '../types'

export class DatabaseService {
  // Business operations
  static async createBusiness(business: Omit<Business, 'id' | 'created_at' | 'updated_at'>): Promise<Business> {
    const { data, error } = await supabase
      .from('businesses')
      .insert([business])
      .select()
      .single()

    if (error) throw new Error(`Failed to create business: ${error.message}`)
    return data
  }

  static async getBusiness(userId: string): Promise<Business | null> {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows returned
      throw new Error(`Failed to fetch business: ${error.message}`)
    }
    return data
  }

  static async updateBusiness(id: string, updates: Partial<Business>): Promise<Business> {
    const { data, error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update business: ${error.message}`)
    return data
  }

  // Query operations
  static async createQuery(query: Omit<Query, 'id' | 'created_at'>): Promise<Query> {
    const { data, error } = await supabase
      .from('queries')
      .insert([query])
      .select()
      .single()

    if (error) throw new Error(`Failed to create query: ${error.message}`)
    return data
  }

  static async getQueries(projectId: string): Promise<Query[]> {
    const { data, error } = await supabase
      .from('queries')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true })

    if (error) throw new Error(`Failed to fetch queries: ${error.message}`)
    return data || []
  }

  static async getQueriesForBusiness(businessId: string): Promise<Query[]> {
    const { data, error } = await supabase
      .from('queries')
      .select('*')
      .eq('business_id', businessId)
      .order('order_index', { ascending: true })

    if (error) throw new Error(`Failed to fetch queries: ${error.message}`)
    return data || []
  }

  static async updateQuery(id: string, updates: Partial<Query>): Promise<Query> {
    const { data, error } = await supabase
      .from('queries')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update query: ${error.message}`)
    return data
  }

  static async deleteQuery(id: string): Promise<void> {
    const { error } = await supabase
      .from('queries')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete query: ${error.message}`)
  }

  static async getQuery(id: string): Promise<Query | null> {
    console.log('🔍 DatabaseService.getQuery called with ID:', id)
    
    const { data, error } = await supabase
      .from('queries')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.log('❌ Error in getQuery:', error)
      if (error.code === 'PGRST116') return null // No rows returned
      throw new Error(`Failed to fetch query: ${error.message}`)
    }
    
    console.log('✅ Query data retrieved:', data)
    return data
  }

  static async getQueryRankingResults(queryId: string): Promise<RankingAttempt[]> {
    console.log('📊 DatabaseService.getQueryRankingResults called with queryId:', queryId)
    
    const { data, error } = await supabase
      .from('ranking_attempts')
      .select(`
        *,
        analysis_runs!inner(
          id,
          created_at
        ),
        llm_providers!inner(
          id,
          name
        )
      `)
      .eq('query_id', queryId)
      .order('created_at', { ascending: false })

    if (error) {
      console.log('❌ Error in getQueryRankingResults:', error)
      throw new Error(`Failed to fetch ranking results: ${error.message}`)
    }
    
    console.log('✅ Ranking results retrieved:', data)
    return data || []
  }

  static async getCompetitorRankings(queryId: string): Promise<any[]> {
    console.log('🏆 DatabaseService.getCompetitorRankings called with queryId:', queryId)
    
    // First, let's check what ranking attempts we have for this query
    const { data: attempts, error: attemptsError } = await supabase
      .from('ranking_attempts')
      .select('*')
      .eq('query_id', queryId)
    
    console.log('📊 Raw ranking attempts for query:', attempts)
    console.log('📊 Any errors getting attempts:', attemptsError)
    
    // For debugging, let's always use client-side processing to see what's happening
    console.log('🔄 Using client-side processing for debugging...')
    return await this.getCompetitorRankingsClientSide(queryId)
    
    /* Temporarily disable RPC for debugging
    const { data, error } = await supabase
      .rpc('get_competitor_rankings', { query_id: queryId })

    if (error) {
      console.log('❌ Error in getCompetitorRankings RPC:', error)
      console.log('🔄 Falling back to client-side processing...')
      return await this.getCompetitorRankingsClientSide(queryId)
    }
    
    console.log('✅ Competitor rankings retrieved via RPC:', data)
    return data || []
    */
  }

  static async getCompetitorRankingsClientSide(queryId: string): Promise<any[]> {
    try {
      // Get all successful ranking attempts for this query
      const { data: attempts, error: attemptsError } = await supabase
        .from('ranking_attempts')
        .select('*')
        .eq('query_id', queryId)
        .eq('success', true)
        .not('parsed_ranking', 'is', null)

      if (attemptsError) throw attemptsError
      if (!attempts || attempts.length === 0) {
        console.log('❌ No successful attempts with parsed rankings found')
        return []
      }

      console.log('📊 Processing attempts client-side:', attempts)

      // Get user's business name
      const { data: query, error: queryError } = await supabase
        .from('queries')
        .select(`
          *,
          businesses!inner(
            name
          )
        `)
        .eq('id', queryId)
        .single()

      if (queryError) throw queryError
      const userBusinessName = query.businesses.name.toLowerCase()
      console.log('🏢 User business name:', userBusinessName)

      // Process each attempt to extract competitors
      const allCompetitors: any[] = []
      
      attempts.forEach(attempt => {
        console.log(`🔍 Processing attempt ${attempt.attempt_number}:`, {
          hasRanking: !!attempt.parsed_ranking,
          rankingType: Array.isArray(attempt.parsed_ranking) ? 'array' : typeof attempt.parsed_ranking,
          rankingLength: attempt.parsed_ranking?.length,
          targetRank: attempt.target_business_rank,
          firstFewEntries: attempt.parsed_ranking?.slice(0, 3)
        })

        if (!attempt.parsed_ranking || !Array.isArray(attempt.parsed_ranking)) {
          console.log('⚠️ Invalid parsed_ranking for attempt:', attempt.id)
          return
        }

        // Handle case where parsed_ranking is an array of strings (business names)
        // In this format, the index + 1 is the rank
        let userBusinessFoundInThisAttempt = false
        let userBusinessRankInThisAttempt = null
        
        attempt.parsed_ranking.forEach((businessName: string, index: number) => {
          const rank = index + 1
          const businessNameLower = businessName.toLowerCase()
          
          // Check if this is the user's business with more detailed logging
          const isMatch = businessNameLower.includes(userBusinessName) || 
                         userBusinessName.includes(businessNameLower)
          
          if (isMatch) {
            console.log(`🎯 MATCH FOUND! User business "${userBusinessName}" matches "${businessName}" at rank ${rank} in attempt ${attempt.attempt_number}`)
            userBusinessFoundInThisAttempt = true
            userBusinessRankInThisAttempt = rank
            
            // Update the target_business_rank if it wasn't set
            if (attempt.target_business_rank === null) {
              console.log(`📝 Setting target_business_rank to ${rank} for attempt ${attempt.id}`)
              attempt.target_business_rank = rank
            }
          }
        })
        
        console.log(`📊 Attempt ${attempt.attempt_number} summary:`, {
          userBusinessFound: userBusinessFoundInThisAttempt,
          userBusinessRank: userBusinessRankInThisAttempt,
          storedTargetRank: attempt.target_business_rank
        })
        
        // Now find competitors using the determined rank
        const targetRank = attempt.target_business_rank || userBusinessRankInThisAttempt
        if (targetRank) {
          attempt.parsed_ranking.forEach((businessName: string, index: number) => {
            const rank = index + 1
            const businessNameLower = businessName.toLowerCase()
            
            // Add competitors (businesses that rank better than user's business)
            if (rank < targetRank &&
                !businessNameLower.includes(userBusinessName) && 
                !userBusinessName.includes(businessNameLower)) {
              
              allCompetitors.push({
                name: businessName,
                rank: rank,
                attemptId: attempt.id,
                attemptNumber: attempt.attempt_number
              })
            }
          })
        } else {
          console.log(`❌ No target rank found for attempt ${attempt.attempt_number} - user business not found`)
        }
      })

      if (allCompetitors.length === 0) {
        console.log('❌ No competitors found')
        
        // Still return user's business data if available
        const userBusinessData = this.getUserBusinessData(attempts, userBusinessName)
        return userBusinessData ? [userBusinessData] : []
      }

      // Aggregate competitors by business name
      const competitorMap = new Map()
      allCompetitors.forEach(competitor => {
        const name = competitor.name
        if (!competitorMap.has(name)) {
          competitorMap.set(name, {
            business_name: name,
            ranks: [],
            appearances_count: 0,
            total_attempts: attempts.length,
            is_user_business: false
          })
        }
        
        const existing = competitorMap.get(name)
        existing.ranks.push(competitor.rank)
        existing.appearances_count += 1
      })

      // Add user's business data
      const userBusinessData = this.getUserBusinessData(attempts, userBusinessName)
      if (userBusinessData) {
        competitorMap.set(userBusinessData.business_name, {
          ...userBusinessData,
          is_user_business: true
        })
      }

      // Calculate averages and format results with weighted scoring
      const results = Array.from(competitorMap.values()).map(competitor => {
        const averageRank = competitor.ranks.reduce((a: number, b: number) => a + b, 0) / competitor.ranks.length
        const appearanceRate = competitor.appearances_count / competitor.total_attempts
        
        // Weighted score: combines rank quality with consistency
        // Lower score = better (lower rank + higher appearance rate)
        // Formula: (average_rank) * (2 - appearance_rate)
        // This means:
        // - 100% appearance rate: multiply by 1.0 (no penalty)
        // - 50% appearance rate: multiply by 1.5 (moderate penalty)  
        // - 20% appearance rate: multiply by 1.8 (high penalty)
        const weightedScore = averageRank * (2 - appearanceRate)
        
        return {
          business_name: competitor.business_name,
          average_rank: averageRank,
          appearances_count: competitor.appearances_count,
          total_attempts: competitor.total_attempts,
          appearance_rate: appearanceRate,
          weighted_score: weightedScore,
          is_user_business: competitor.is_user_business || false
        }
      }).sort((a, b) => a.weighted_score - b.weighted_score) // Sort by weighted score instead of just rank

      console.log('✅ Final competitor rankings (weighted by consistency):', results)
      return results

    } catch (error) {
      console.error('💥 Error in client-side competitor rankings:', error)
      return []
    }
  }

  private static getUserBusinessData(attempts: any[], userBusinessName: string): any | null {
    const userRanks: number[] = []
    let userAppearances = 0
    let userBusinessDisplayName = userBusinessName

    attempts.forEach(attempt => {
      if (!attempt.parsed_ranking || !Array.isArray(attempt.parsed_ranking)) return

      attempt.parsed_ranking.forEach((businessName: string, index: number) => {
        const rank = index + 1
        const businessNameLower = businessName.toLowerCase()
        
        // Check if this is the user's business
        if (businessNameLower.includes(userBusinessName) || 
            userBusinessName.includes(businessNameLower)) {
          userRanks.push(rank)
          userAppearances += 1
          userBusinessDisplayName = businessName // Use the actual name from results
        }
      })
    })

    if (userRanks.length === 0) return null

    const averageRank = userRanks.reduce((a, b) => a + b, 0) / userRanks.length
    const appearanceRate = userAppearances / attempts.length
    const weightedScore = averageRank * (2 - appearanceRate)

    return {
      business_name: userBusinessDisplayName,
      ranks: userRanks,
      appearances_count: userAppearances,
      total_attempts: attempts.length,
      average_rank: averageRank,
      appearance_rate: appearanceRate,
      weighted_score: weightedScore
    }
  }

  // LLM Provider operations
  static async getLLMProviders(): Promise<LLMProvider[]> {
    const { data, error } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw new Error(`Failed to fetch LLM providers: ${error.message}`)
    return data || []
  }

  // Analysis Run operations
  static async createAnalysisRun(businessId: string, totalQueries: number): Promise<AnalysisRun> {
    const { data, error } = await supabase
      .from('analysis_runs')
      .insert([{
        business_id: businessId,
        run_date: new Date().toISOString().split('T')[0], // Today's date
        status: 'pending',
        total_queries: totalQueries,
        completed_queries: 0,
        total_llm_calls: totalQueries * 5, // 5 attempts per query per LLM
        completed_llm_calls: 0
      }])
      .select()
      .single()

    if (error) throw new Error(`Failed to create analysis run: ${error.message}`)
    return data
  }

  static async updateAnalysisRun(id: string, updates: Partial<AnalysisRun>): Promise<AnalysisRun> {
    const { data, error } = await supabase
      .from('analysis_runs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update analysis run: ${error.message}`)
    return data
  }

  // Weekly Analysis operations
  static async canRunWeeklyAnalysis(businessId: string): Promise<import('../types').WeeklyAnalysisCheck> {
    // For development: bypass weekly limit until week_start_date column is added
    // TODO: Remove this when moving to production
    if (import.meta.env.DEV || import.meta.env.VITE_DISABLE_WEEKLY_LIMIT === 'true') {
      console.log('🚧 Development mode: Weekly analysis limit disabled');
      return { canRun: true };
    }

    try {
      const today = new Date();
      const weekStart = new Date(today);
      // Get Monday of current week (Monday = 1, Sunday = 0)
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      weekStart.setDate(today.getDate() + daysToMonday);
      weekStart.setHours(0, 0, 0, 0);

      const { data: existingRun, error } = await supabase
        .from('analysis_runs')
        .select('*')
        .eq('business_id', businessId)
        .gte('run_date', weekStart.toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (existingRun) {
        const nextWeek = new Date(weekStart);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        return {
          canRun: false,
          lastRunDate: existingRun.run_date,
          nextAllowedDate: nextWeek.toISOString().split('T')[0],
          currentWeekRun: existingRun
        };
      }

      return { canRun: true };
    } catch (error) {
      console.error('Error checking weekly analysis:', error);
      // If there's any error (like missing week_start_date column), allow analysis in dev
      if (import.meta.env.DEV) {
        console.warn('🚧 Database error in dev mode, allowing analysis to proceed');
        return { canRun: true };
      }
      throw error;
    }
  }

  static async getWeeklyAnalysisHistory(businessId: string, limit: number = 10): Promise<AnalysisRun[]> {
    try {
      const { data, error } = await supabase
        .from('analysis_runs')
        .select('*')
        .eq('business_id', businessId)
        .order('run_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching analysis history:', error);
      throw error;
    }
  }

  static async getRankingAttemptsForRun(analysisRunId: string): Promise<RankingAttempt[]> {
    try {
      const { data, error } = await supabase
        .from('ranking_attempts')
        .select('*')
        .eq('analysis_run_id', analysisRunId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching ranking attempts for run:', error);
      throw error;
    }
  }

  static async getQueryRankingHistory(queryId: string, limit: number = 10): Promise<import('../types').QueryRankingHistory[]> {
    try {
      console.log(`Fetching ranking history for query: ${queryId}`)
      
      const { data, error } = await supabase
        .from('ranking_attempts')
        .select(`
          analysis_run_id,
          target_business_rank,
          success,
          analysis_runs!inner(
            run_date
          )
        `)
        .eq('query_id', queryId)
        .limit(limit * 20); // Get more data to group by run

      console.log(`Raw data for query ${queryId}:`, { data, error })

      if (error) throw error;
      
      // Group by analysis run and calculate stats
      const runStats = new Map<string, {
        run_date: string
        analysis_run_id: string
        ranks: number[]
        total_attempts: number
        successful_attempts: number
      }>();

      data?.forEach((attempt: any) => {
        const runId = attempt.analysis_run_id;
        const runDate = attempt.analysis_runs?.run_date;
        
        if (!runStats.has(runId)) {
          runStats.set(runId, {
            run_date: runDate,
            analysis_run_id: runId,
            ranks: [],
            total_attempts: 0,
            successful_attempts: 0
          });
        }
        
        const stats = runStats.get(runId)!;
        stats.total_attempts++;
        
        if (attempt.success && attempt.target_business_rank) {
          stats.successful_attempts++;
          stats.ranks.push(attempt.target_business_rank);
        }
      });

      // Convert to final format
      return Array.from(runStats.values())
        .sort((a, b) => new Date(a.run_date).getTime() - new Date(b.run_date).getTime())
        .slice(-limit)
        .map(stats => ({
          run_date: stats.run_date,
          analysis_run_id: stats.analysis_run_id,
          average_rank: stats.ranks.length > 0 
            ? stats.ranks.reduce((sum, rank) => sum + rank, 0) / stats.ranks.length 
            : null,
          best_rank: stats.ranks.length > 0 ? Math.min(...stats.ranks) : null,
          worst_rank: stats.ranks.length > 0 ? Math.max(...stats.ranks) : null,
          total_attempts: stats.total_attempts,
          successful_attempts: stats.successful_attempts
        }));
    } catch (error) {
      console.error('Error fetching query ranking history:', error);
      throw error;
    }
  }

  // Ranking Attempt operations
  static async createRankingAttempt(attempt: Omit<RankingAttempt, 'id' | 'created_at'>): Promise<RankingAttempt> {
    const { data, error } = await supabase
      .from('ranking_attempts')
      .insert([attempt])
      .select()
      .single()

    if (error) throw new Error(`Failed to create ranking attempt: ${error.message}`)
    return data
  }

  static async saveRankingAttempts(attempts: Omit<RankingAttempt, 'id' | 'created_at'>[]): Promise<RankingAttempt[]> {
    const { data, error } = await supabase
      .from('ranking_attempts')
      .insert(attempts)
      .select()

    if (error) throw new Error(`Failed to save ranking attempts: ${error.message}`)
    return data || []
  }

  // Legacy method for backward compatibility
  static async saveRankingResults(results: Omit<RankingResult, 'id' | 'created_at'>[]): Promise<RankingResult[]> {
    // Convert to ranking attempts format
    // For now, we'll need to create an analysis run first
    if (results.length === 0) return []
    
    // Get the business ID from the first query
    const { data: query } = await supabase
      .from('queries')
      .select('business_id')
      .eq('id', results[0].query_id)
      .single()

    if (!query) throw new Error('Query not found')

    // Create an analysis run for this batch
    const analysisRun = await this.createAnalysisRun(query.business_id, 1)

    // Convert results to attempts
    const attempts = results.map(result => ({
      analysis_run_id: analysisRun.id,
      query_id: result.query_id,
      llm_provider_id: result.llm_provider_id,
      attempt_number: result.attempt_number,
      parsed_ranking: result.ranked_businesses,
      target_business_rank: result.target_business_rank,
      success: true
    }))

    const savedAttempts = await this.saveRankingAttempts(attempts)

    // Update analysis run status
    await this.updateAnalysisRun(analysisRun.id, {
      status: 'completed',
      completed_queries: 1,
      completed_llm_calls: savedAttempts.length,
      completed_at: new Date().toISOString()
    })

    // Convert back to RankingResult format for compatibility
    return savedAttempts.map(attempt => ({
      id: attempt.id,
      query_id: attempt.query_id,
      llm_provider_id: attempt.llm_provider_id,
      attempt_number: attempt.attempt_number,
      ranked_businesses: attempt.parsed_ranking,
      target_business_rank: attempt.target_business_rank,
      response_time_ms: 0,
      created_at: attempt.created_at
    }))
  }

  static async getRankingResults(queryId: string): Promise<RankingResult[]> {
    const { data, error } = await supabase
      .from('ranking_results')
      .select(`
        *,
        llm_providers (name)
      `)
      .eq('query_id', queryId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch ranking results: ${error.message}`)
    return data || []
  }

  // Analytics operations
  static async getRankingAnalyticsForBusiness(businessId: string): Promise<RankingAnalytics[]> {
    // Get all queries for the business with their ranking attempts
    const { data: queries, error: queriesError } = await supabase
      .from('queries')
      .select(`
        *,
        ranking_attempts (
          *,
          llm_providers (name)
        )
      `)
      .eq('business_id', businessId)

    if (queriesError) throw new Error(`Failed to fetch analytics: ${queriesError.message}`)

    // Get the business to know the business name
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single()

    if (businessError) throw new Error('Business not found')

    return this.calculateRankingAnalytics(queries || [], business.name)
  }

  // Get detailed ranking results for table display
  static async getDetailedRankingResults(businessId: string): Promise<{
    queries: Array<{
      id: string
      text: string
      attempts: Array<{
        id: string
        llm_provider: string
        attempt_number: number
        target_business_rank: number | null
        total_businesses: number
        success: boolean
        created_at: string
      }>
      averageRank: number | null
      mentionRate: number
    }>
    overallAverageRank: number | null
    overallMentionRate: number
  }> {
    const { data: queries, error: queriesError } = await supabase
      .from('queries')
      .select(`
        id,
        text,
        ranking_attempts (
          id,
          attempt_number,
          target_business_rank,
          parsed_ranking,
          success,
          created_at,
          llm_provider_id,
          llm_providers!inner (
            name
          )
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: true })

    if (queriesError) throw new Error(`Failed to fetch ranking results: ${queriesError.message}`)

    const processedQueries = (queries || []).map(query => {
      const attempts = (query.ranking_attempts || []).map((attempt: any) => ({
        id: attempt.id,
        llm_provider: attempt.llm_providers?.name || 'Unknown',
        attempt_number: attempt.attempt_number,
        target_business_rank: attempt.target_business_rank,
        total_businesses: Array.isArray(attempt.parsed_ranking) ? attempt.parsed_ranking.length : 0,
        success: attempt.success,
        created_at: attempt.created_at
      }))

      // Calculate average rank for this query (only successful attempts where business was found)
      const successfulRanks = attempts
        .filter(a => a.success && a.target_business_rank !== null)
        .map(a => a.target_business_rank!)
      
      const averageRank = successfulRanks.length > 0 
        ? successfulRanks.reduce((sum, rank) => sum + rank, 0) / successfulRanks.length 
        : null

      // Calculate mention rate (percentage of attempts where business was found)
      const mentionRate = attempts.length > 0 
        ? (successfulRanks.length / attempts.length) * 100 
        : 0

      return {
        id: query.id,
        text: query.text,
        attempts,
        averageRank,
        mentionRate
      }
    })

    // Calculate overall statistics
    const allRanks = processedQueries
      .filter(q => q.averageRank !== null)
      .map(q => q.averageRank!)
    
    const overallAverageRank = allRanks.length > 0 
      ? allRanks.reduce((sum, rank) => sum + rank, 0) / allRanks.length 
      : null

    const totalAttempts = processedQueries.reduce((sum, q) => sum + q.attempts.length, 0)
    const totalMentions = processedQueries.reduce((sum, q) => 
      sum + q.attempts.filter(a => a.success && a.target_business_rank !== null).length, 0)
    
    const overallMentionRate = totalAttempts > 0 ? (totalMentions / totalAttempts) * 100 : 0

    return {
      queries: processedQueries,
      overallAverageRank,
      overallMentionRate
    }
  }

  private static calculateRankingAnalytics(queries: any[], businessName: string): RankingAnalytics[] {
    const analytics: RankingAnalytics[] = []

    for (const query of queries || []) {
      const attempts = query.ranking_attempts || []
      
      // Group attempts by LLM provider
      const providerStats = new Map<string, {
        ranks: number[]
        mentions: number
      }>()

      const allRanks: number[] = []
      let totalMentions = 0

      for (const attempt of attempts) {
        if (attempt.target_business_rank && attempt.success) {
          const providerName = attempt.llm_providers?.name || 'Unknown'
          
          if (!providerStats.has(providerName)) {
            providerStats.set(providerName, { ranks: [], mentions: 0 })
          }
          
          const stats = providerStats.get(providerName)!
          stats.ranks.push(attempt.target_business_rank)
          stats.mentions++
          
          allRanks.push(attempt.target_business_rank)
          totalMentions++
        }
      }

      // Calculate average rank
      const averageRank = allRanks.length > 0 
        ? allRanks.reduce((sum, rank) => sum + rank, 0) / allRanks.length 
        : undefined

      // Build LLM breakdown
      const llmBreakdown = Array.from(providerStats.entries()).map(([providerName, stats]) => ({
        provider_name: providerName,
        average_rank: stats.ranks.length > 0 
          ? stats.ranks.reduce((sum, rank) => sum + rank, 0) / stats.ranks.length 
          : undefined,
        mention_count: stats.mentions,
        best_rank: stats.ranks.length > 0 ? Math.min(...stats.ranks) : undefined,
        worst_rank: stats.ranks.length > 0 ? Math.max(...stats.ranks) : undefined
      }))

      // Find competitors ranked higher
      const competitorMap = new Map<string, { ranks: number[], mentions: number }>()
      
      for (const attempt of attempts) {
        const rankedBusinesses = attempt.parsed_ranking as string[]
        const targetRank = attempt.target_business_rank
        
        if (targetRank && rankedBusinesses && attempt.success) {
          // Get businesses ranked higher than target
          const higherRankedBusinesses = rankedBusinesses.slice(0, targetRank - 1)
          
          for (const business of higherRankedBusinesses) {
            if (business !== businessName) {
              if (!competitorMap.has(business)) {
                competitorMap.set(business, { ranks: [], mentions: 0 })
              }
              
              const competitor = competitorMap.get(business)!
              competitor.ranks.push(rankedBusinesses.indexOf(business) + 1)
              competitor.mentions++
            }
          }
        }
      }

      const competitorsRankedHigher = Array.from(competitorMap.entries())
        .map(([businessName, stats]) => ({
          business_name: businessName,
          average_rank: stats.ranks.reduce((sum, rank) => sum + rank, 0) / stats.ranks.length,
          mention_count: stats.mentions
        }))
        .sort((a, b) => a.average_rank - b.average_rank)

      analytics.push({
        query_id: query.id,
        query_text: query.text,
        average_rank: averageRank,
        total_mentions: totalMentions,
        llm_breakdown: llmBreakdown,
        competitors_ranked_higher: competitorsRankedHigher
      })
    }

    return analytics
  }

  static async getDashboardData(userId: string): Promise<DashboardData> {
    const business = await this.getBusiness(userId)
    if (!business) throw new Error('Business not found')

    const queries = await this.getQueriesForBusiness(business.id)
    const analytics = await this.getRankingAnalyticsForBusiness(business.id)

    // Calculate overall stats
    const totalQueries = queries.length
    let totalLLMCalls = 0
    let totalMentions = 0
    const allRanks: number[] = []

    for (const analytic of analytics) {
      totalMentions += analytic.total_mentions
      if (analytic.average_rank) {
        allRanks.push(analytic.average_rank)
      }
      
      // Count LLM calls
      for (const llmStat of analytic.llm_breakdown) {
        totalLLMCalls += llmStat.mention_count
      }
    }

    const overallAverageRank = allRanks.length > 0 
      ? allRanks.reduce((sum, rank) => sum + rank, 0) / allRanks.length 
      : undefined

    return {
      business,
      queries,
      analytics,
      overall_stats: {
        total_queries: totalQueries,
        total_llm_calls: totalLLMCalls,
        overall_average_rank: overallAverageRank,
        total_mentions: totalMentions
      }
    }
  }
}
