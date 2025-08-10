import { supabase } from '../supabase'
import type { 
  Business,
  Project, 
  Query, 
  LLMProvider, 
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

  // Legacy project operations (keeping for backward compatibility if needed)
  static async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert([project])
      .select()
      .single()

    if (error) throw new Error(`Failed to create project: ${error.message}`)
    return data
  }

  static async getProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch projects: ${error.message}`)
    return data || []
  }

  static async getProject(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch project: ${error.message}`)
    }
    return data
  }

  static async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update project: ${error.message}`)
    return data
  }

  static async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete project: ${error.message}`)
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

  // Ranking Results operations
  static async saveRankingResults(results: Omit<RankingResult, 'id' | 'created_at'>[]): Promise<RankingResult[]> {
    const { data, error } = await supabase
      .from('ranking_results')
      .insert(results)
      .select()

    if (error) throw new Error(`Failed to save ranking results: ${error.message}`)
    return data || []
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
  static async getRankingAnalytics(projectId: string): Promise<RankingAnalytics[]> {
    // This is a complex query that aggregates ranking data
    const { data: queries, error: queriesError } = await supabase
      .from('queries')
      .select(`
        *,
        ranking_results (
          *,
          llm_providers (name)
        )
      `)
      .eq('project_id', projectId)

    if (queriesError) throw new Error(`Failed to fetch analytics: ${queriesError.message}`)

    // Get the project to know the business name
    const project = await this.getProject(projectId)
    if (!project) throw new Error('Project not found')

    return this.calculateRankingAnalytics(queries || [], project.business_name)
  }

  static async getRankingAnalyticsForBusiness(businessId: string): Promise<RankingAnalytics[]> {
    // This is a complex query that aggregates ranking data
    const { data: queries, error: queriesError } = await supabase
      .from('queries')
      .select(`
        *,
        ranking_results (
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

  private static calculateRankingAnalytics(queries: any[], businessName: string): RankingAnalytics[] {

    const analytics: RankingAnalytics[] = []

    for (const query of queries || []) {
      const results = query.ranking_results || []
      
      // Group results by LLM provider
      const providerStats = new Map<string, {
        ranks: number[]
        mentions: number
      }>()

      const allRanks: number[] = []
      let totalMentions = 0

      for (const result of results) {
        if (result.target_business_rank) {
          const providerName = result.llm_providers?.name || 'Unknown'
          
          if (!providerStats.has(providerName)) {
            providerStats.set(providerName, { ranks: [], mentions: 0 })
          }
          
          const stats = providerStats.get(providerName)!
          stats.ranks.push(result.target_business_rank)
          stats.mentions++
          
          allRanks.push(result.target_business_rank)
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
      
      for (const result of results) {
        const rankedBusinesses = result.ranked_businesses as string[]
        const targetRank = result.target_business_rank
        
        if (targetRank && rankedBusinesses) {
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
