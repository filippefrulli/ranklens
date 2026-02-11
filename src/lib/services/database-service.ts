import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Company,
  Product,
  Measurement,
  LLMProvider,
  AnalysisRun,
  RankingAttempt,
  CompetitorResult,
  MeasurementRankingHistory
} from '../types'
import { BusinessNameStandardizationService } from './business-name-standardization-service'

/**
 * Unified database service with authenticated Supabase client (respects RLS).
 * All table/column names match schema_v2.
 */
export class DatabaseService {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[.,;:'"!?()]/g, '')
      .replace(/\s*-\s*/g, ' ')
      .replace(/\s*&\s*/g, ' and ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // ── Company operations ───────────────────────────────────────────────────

  async getCompany(): Promise<Company | null> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('user_id', this.userId)
      .single()

    if (error) {
      console.error('[Service] getCompany: Error', error)
      return null
    }
    return data
  }

  async createCompany(companyData: {
    name: string
    google_place_id?: string
    google_primary_type?: string
    google_primary_type_display?: string
  }): Promise<Company> {
    const { data, error } = await this.supabase
      .from('companies')
      .insert([{ user_id: this.userId, ...companyData }])
      .select()
      .single()

    if (error) {
      console.error('[Service] createCompany: Error', error)
      throw new Error(`Failed to create company: ${error.message}`)
    }
    return data
  }

  async validateCompanyOwnership(companyId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('user_id')
      .eq('id', companyId)
      .single()

    if (error || !data) return false
    return data.user_id === this.userId
  }

  // ── Product operations ───────────────────────────────────────────────────

  async getProductsForCompany(companyId: string): Promise<Product[]> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[Service] getProductsForCompany: Error', error)
      return []
    }
    return data || []
  }

  async getProduct(productId: string): Promise<Product | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (error) {
      console.error('[Service] getProduct: Error', error)
      return null
    }
    return data
  }

  async getProductWithCompany(productId: string): Promise<(Product & { company: Company }) | null> {
    const { data, error } = await this.supabase
      .from('products')
      .select('*, company:companies!inner(id, name, user_id, created_at, updated_at)')
      .eq('id', productId)
      .single()

    if (error) {
      console.error('[Service] getProductWithCompany: Error', error)
      return null
    }
    return data as any
  }

  async createProduct(productData: {
    company_id: string
    name: string
    description?: string
    image_url?: string
  }): Promise<Product> {
    // Get the next display_order
    const { data: existing } = await this.supabase
      .from('products')
      .select('display_order')
      .eq('company_id', productData.company_id)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0

    const { data, error } = await this.supabase
      .from('products')
      .insert([{ ...productData, display_order: nextOrder }])
      .select()
      .single()

    if (error) {
      console.error('[Service] createProduct: Error', error)
      throw new Error(`Failed to create product: ${error.message}`)
    }
    return data
  }

  async validateProductOwnership(productId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('products')
      .select('id, companies!inner(user_id)')
      .eq('id', productId)
      .single()

    if (error || !data) return false
    return (data as any).companies?.user_id === this.userId
  }

  // ── Measurement operations ───────────────────────────────────────────────

  async getMeasurementsForProduct(productId: string): Promise<Measurement[]> {
    const { data, error } = await this.supabase
      .from('measurements')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[Service] getMeasurementsForProduct: Error', error)
      return []
    }
    return data || []
  }

  async getMeasurement(measurementId: string): Promise<Measurement | null> {
    const { data, error } = await this.supabase
      .from('measurements')
      .select('*')
      .eq('id', measurementId)
      .single()

    if (error) {
      console.error('[Service] getMeasurement: Error', error)
      return null
    }
    return data
  }

  async createMeasurement(measurementData: {
    product_id: string
    title: string
    query: string
  }): Promise<Measurement> {
    // Get the next display_order
    const { data: existing } = await this.supabase
      .from('measurements')
      .select('display_order')
      .eq('product_id', measurementData.product_id)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0

    const { data, error } = await this.supabase
      .from('measurements')
      .insert([{ ...measurementData, display_order: nextOrder }])
      .select()
      .single()

    if (error) {
      console.error('[Service] createMeasurement: Error', error)
      throw new Error(`Failed to create measurement: ${error.message}`)
    }
    return data
  }

  async deleteMeasurement(measurementId: string): Promise<void> {
    const { error } = await this.supabase
      .from('measurements')
      .delete()
      .eq('id', measurementId)

    if (error) {
      console.error('[Service] deleteMeasurement: Error', error)
      throw new Error(`Failed to delete measurement: ${error.message}`)
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    const { error } = await this.supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) {
      console.error('[Service] deleteProduct: Error', error)
      throw new Error(`Failed to delete product: ${error.message}`)
    }
  }

  // ── LLM Provider operations ──────────────────────────────────────────────

  async getActiveLLMProviders(): Promise<LLMProvider[]> {
    const { data, error } = await this.supabase
      .from('llm_providers')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('[Service] getActiveLLMProviders: Error', error)
      throw new Error(`Failed to fetch LLM providers: ${error.message}`)
    }
    return data || []
  }

  // ── Analysis Run operations ──────────────────────────────────────────────

  async createAnalysisRun(productId: string, totalMeasurements: number): Promise<AnalysisRun> {
    console.log(`[Service] createAnalysisRun: product=${productId}, measurements=${totalMeasurements}`)

    const { data, error } = await this.supabase
      .from('analysis_runs')
      .insert([{
        product_id: productId,
        total_measurements: totalMeasurements,
        started_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('[Service] createAnalysisRun: Error', error)
      throw new Error(`Failed to create analysis run: ${error.message}`)
    }
    console.log(`[Service] createAnalysisRun: Created ${data.id}`)
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

  async getRunningAnalysisForProduct(productId: string): Promise<AnalysisRun | null> {
    const { data, error } = await this.supabase
      .from('analysis_runs')
      .select('*')
      .eq('product_id', productId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[Service] getRunningAnalysisForProduct: Error', error)
      return null
    }
    return data
  }

  async getAnalysisRunsForProduct(productId: string): Promise<Pick<AnalysisRun, 'id' | 'created_at'>[]> {
    const { data, error } = await this.supabase
      .from('analysis_runs')
      .select('id, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Service] getAnalysisRunsForProduct: Error', error)
      return []
    }
    return data || []
  }

  async getAnalysisRunsForMeasurement(measurementId: string): Promise<Pick<AnalysisRun, 'id' | 'created_at'>[]> {
    // Single query: get runs that have ranking_attempts for this measurement
    const { data, error } = await this.supabase
      .from('analysis_runs')
      .select('id, created_at, ranking_attempts!inner(measurement_id)')
      .eq('ranking_attempts.measurement_id', measurementId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Service] getAnalysisRunsForMeasurement: Error', error)
      return []
    }

    // Deduplicate (the join may return duplicates) and strip the join data
    const seen = new Set<string>()
    return (data || []).filter(run => {
      if (seen.has(run.id)) return false
      seen.add(run.id)
      return true
    }).map(({ id, created_at }) => ({ id, created_at }))
  }

  /**
   * Get summary stats (last run date + average rank) for each measurement of a product.
   * Returns a map of measurementId → { lastRunAt, averageRank }.
   */
  async getMeasurementSummaries(productId: string): Promise<Map<string, { lastRunAt: string | null, averageRank: number | null }>> {
    const result = new Map<string, { lastRunAt: string | null, averageRank: number | null }>()

    try {
      // Get the most recent completed analysis run for this product
      const { data: runs, error: runError } = await this.supabase
        .from('analysis_runs')
        .select('id, created_at')
        .eq('product_id', productId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)

      if (runError || !runs || runs.length === 0) return result

      const latestRun = runs[0]

      // Get all ranking attempts for this run, grouped by measurement
      const { data: attempts, error: attError } = await this.supabase
        .from('ranking_attempts')
        .select('measurement_id, target_product_rank, success, created_at')
        .eq('analysis_run_id', latestRun.id)

      if (attError || !attempts) return result

      // Group by measurement_id
      const byMeasurement = new Map<string, { ranks: number[], maxCreatedAt: string }>()
      for (const att of attempts) {
        if (!byMeasurement.has(att.measurement_id)) {
          byMeasurement.set(att.measurement_id, { ranks: [], maxCreatedAt: att.created_at })
        }
        const entry = byMeasurement.get(att.measurement_id)!
        if (att.created_at > entry.maxCreatedAt) entry.maxCreatedAt = att.created_at
        if (att.success && att.target_product_rank != null) {
          entry.ranks.push(att.target_product_rank)
        }
      }

      for (const [measurementId, data] of byMeasurement) {
        const avgRank = data.ranks.length > 0
          ? data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length
          : null
        result.set(measurementId, {
          lastRunAt: latestRun.created_at,
          averageRank: avgRank != null ? Number(avgRank.toFixed(1)) : null
        })
      }
    } catch (err: any) {
      console.error('[Service] getMeasurementSummaries: Error', { error: err?.message })
    }

    return result
  }

  // ── Ranking Attempts ─────────────────────────────────────────────────────

  async saveRankingAttempts(attempts: Omit<RankingAttempt, 'id' | 'created_at'>[]): Promise<void> {
    const { error } = await this.supabase
      .from('ranking_attempts')
      .insert(attempts)

    if (error) {
      throw new Error(`Failed to save ranking attempts: ${error.message}`)
    }
  }

  // ── Competitor Results ────────────────────────────────────────────────────

  async populateCompetitorResultsForAnalysisRun(analysisRunId: string): Promise<number> {
    // Get all unique measurement IDs for this analysis run
    const { data: measurementIds, error: mError } = await this.supabase
      .from('ranking_attempts')
      .select('measurement_id')
      .eq('analysis_run_id', analysisRunId)
      .not('measurement_id', 'is', null)

    if (mError) {
      console.error('[Service] populateCompetitorResults: Error fetching measurement IDs', mError)
      throw new Error(`Failed to fetch measurement IDs: ${mError.message}`)
    }

    if (!measurementIds || measurementIds.length === 0) return 0

    const uniqueIds = [...new Set(measurementIds.map(m => m.measurement_id))]

    let totalInserted = 0
    for (const measurementId of uniqueIds) {
      try {
        const inserted = await this.populateCompetitorResultsForMeasurement(measurementId, analysisRunId)
        totalInserted += inserted
      } catch (error) {
        console.error(`[Service] Error populating results for measurement ${measurementId}:`, error)
      }
    }
    return totalInserted
  }

  async populateCompetitorResultsForMeasurement(measurementId: string, analysisRunId: string): Promise<number> {
    // Get the user's product name via measurement → product → company
    const { data: measurementData, error: mError } = await this.supabase
      .from('measurements')
      .select(`
        *,
        products!inner(
          name
        )
      `)
      .eq('id', measurementId)
      .single()

    if (mError) {
      throw new Error(`Failed to fetch measurement data: ${mError.message}`)
    }

    const userProductName = measurementData.products.name.toLowerCase().trim()

    // Get ALL ranking attempts for this measurement and run
    const { data: attempts, error: attemptsError } = await this.supabase
      .from('ranking_attempts')
      .select(`
        *,
        llm_providers!inner(
          id,
          name
        )
      `)
      .eq('measurement_id', measurementId)
      .eq('analysis_run_id', analysisRunId)
      .not('parsed_ranking', 'is', null)

    if (attemptsError) {
      throw new Error(`Failed to fetch ranking attempts: ${attemptsError.message}`)
    }

    if (!attempts || attempts.length === 0) return 0

    // Clear existing results for this measurement/run
    const { error: deleteError } = await this.supabase
      .from('competitor_results')
      .delete()
      .eq('measurement_id', measurementId)
      .eq('analysis_run_id', analysisRunId)

    if (deleteError) {
      console.warn('[Service] Error clearing existing results:', deleteError)
    }

    // Build product map from all attempts
    const productMap = new Map<string, {
      product_name: string
      original_names: string[]
      ranks: number[]
      llm_providers: string[]
      appearances_count: number
      is_target: boolean
      ranksByProvider: Map<string, number[]>
    }>()

    attempts.forEach(attempt => {
      try {
        let parsedRanking: string[]
        if (typeof attempt.parsed_ranking === 'string') {
          parsedRanking = JSON.parse(attempt.parsed_ranking)
        } else if (Array.isArray(attempt.parsed_ranking)) {
          parsedRanking = attempt.parsed_ranking
        } else {
          return
        }
        if (!Array.isArray(parsedRanking)) return

        const providerName = attempt.llm_providers?.name || 'Unknown'
        const userProductRank = attempt.target_product_rank
        const truncationLimit = this.calculateTruncationLimit(userProductRank, parsedRanking.length)
        const productsToProcess = parsedRanking.slice(0, truncationLimit)

        productsToProcess.forEach((productName, index) => {
          const rank = index + 1
          const productKey = this.normalizeProductName(productName)
          const isTarget = userProductRank !== null && rank === userProductRank

          if (!productMap.has(productKey)) {
            productMap.set(productKey, {
              product_name: productName,
              original_names: [productName],
              ranks: [],
              llm_providers: [],
              appearances_count: 0,
              is_target: isTarget,
              ranksByProvider: new Map()
            })
          }

          const product = productMap.get(productKey)!
          product.ranks.push(rank)
          product.appearances_count++

          if (!product.ranksByProvider.has(providerName)) {
            product.ranksByProvider.set(providerName, [])
          }
          product.ranksByProvider.get(providerName)!.push(rank)

          if (!product.original_names.includes(productName)) {
            product.original_names.push(productName)
          }
          if (!product.llm_providers.includes(providerName)) {
            product.llm_providers.push(providerName)
          }
          if (isTarget) product.is_target = true
        })
      } catch (parseError) {
        console.warn('[Service] Failed to parse ranking for attempt:', attempt.id, parseError)
      }
    })

    if (productMap.size === 0) return 0

    // Standardize names
    const allProductNames = Array.from(productMap.keys())
    let standardizations
    try {
      standardizations = await BusinessNameStandardizationService.standardizeBusinessNames(
        allProductNames.map(key => productMap.get(key)!.product_name)
      )
    } catch {
      standardizations = allProductNames.map(key => ({
        originalName: productMap.get(key)!.product_name,
        standardizedName: productMap.get(key)!.product_name,
        confidence: 'low' as const
      }))
    }

    const nameMap = new Map<string, string>()
    for (const s of standardizations) {
      nameMap.set(s.originalName, s.standardizedName)
    }

    // Merge standardized entries
    const standardizedMap = new Map<string, typeof productMap extends Map<string, infer V> ? V : never>()

    for (const [, product] of productMap) {
      const stdName = nameMap.get(product.product_name) || product.product_name
      const stdKey = this.normalizeProductName(stdName)

      if (!standardizedMap.has(stdKey)) {
        standardizedMap.set(stdKey, {
          product_name: stdName,
          original_names: [...product.original_names],
          ranks: [...product.ranks],
          llm_providers: [...product.llm_providers],
          appearances_count: product.appearances_count,
          is_target: product.is_target,
          ranksByProvider: new Map(product.ranksByProvider)
        })
      } else {
        const existing = standardizedMap.get(stdKey)!
        existing.original_names.push(...product.original_names)
        existing.ranks.push(...product.ranks)
        existing.appearances_count += product.appearances_count
        for (const provider of product.llm_providers) {
          if (!existing.llm_providers.includes(provider)) existing.llm_providers.push(provider)
        }
        for (const [provider, ranks] of product.ranksByProvider) {
          if (!existing.ranksByProvider.has(provider)) {
            existing.ranksByProvider.set(provider, [...ranks])
          } else {
            existing.ranksByProvider.get(provider)!.push(...ranks)
          }
        }
        if (product.is_target) existing.is_target = true
      }
    }

    // Build competitor result rows (one per provider per product)
    const competitorResults: any[] = []
    for (const product of standardizedMap.values()) {
      product.ranksByProvider.forEach((ranks, providerName) => {
        const averageRank = ranks.reduce((s, r) => s + r, 0) / ranks.length
        const bestRank = Math.min(...ranks)
        const worstRank = Math.max(...ranks)
        const providerAttempts = attempts.filter(a => a.llm_providers?.name === providerName).length
        const appearanceRate = ranks.length / providerAttempts
        // Weighted score: average rank + heavy penalty for low appearance rate
        // A product appearing 1/10 times at rank #1 gets 1 + 25*(0.9)^2 = 21.25
        // A product appearing 10/10 times at rank #6 gets 6 + 25*(0)^2 = 6.0
        const weightedScore = averageRank + 25 * Math.pow(1 - appearanceRate, 2)

        competitorResults.push({
          measurement_id: measurementId,
          analysis_run_id: analysisRunId,
          product_name: product.product_name,
          average_rank: Number(averageRank.toFixed(2)),
          best_rank: bestRank,
          worst_rank: worstRank,
          appearances_count: ranks.length,
          total_attempts: providerAttempts,
          appearance_rate: Number(appearanceRate.toFixed(2)),
          weighted_score: Number(weightedScore.toFixed(2)),
          llm_providers: [providerName],
          raw_ranks: ranks,
          is_target: product.is_target
        })
      })
    }

    if (competitorResults.length === 0) return 0

    const { data: insertedData, error: insertError } = await this.supabase
      .from('competitor_results')
      .insert(competitorResults)
      .select('id')

    if (insertError) {
      console.error('[Service] Error inserting competitor results:', insertError)
      throw new Error(`Failed to insert competitor results: ${insertError.message}`)
    }

    const insertedCount = insertedData?.length || 0
    console.log(`[Service] Competitor results populated: ${insertedCount} entries for analysis run ${analysisRunId}`)
    return insertedCount
  }

  private calculateTruncationLimit(userRank: number | null | undefined, totalProducts: number): number {
    if (!userRank) return totalProducts
    const roundedRank = Math.ceil(userRank / 5) * 5
    return Math.min(roundedRank, totalProducts)
  }

  async getCompetitorResults(measurementId: string, analysisRunId: string): Promise<CompetitorResult[]> {
    const { data, error } = await this.supabase
      .from('competitor_results')
      .select('*')
      .eq('measurement_id', measurementId)
      .eq('analysis_run_id', analysisRunId)
      .order('weighted_score', { ascending: true })

    if (error) {
      console.error('[Service] getCompetitorResults: Error', error)
      throw new Error(`Failed to fetch competitor results: ${error.message}`)
    }
    return data || []
  }

  // ── Measurement Ranking History ───────────────────────────────────────────

  async getMeasurementRankingHistory(measurementId: string, limit: number = 10): Promise<MeasurementRankingHistory[]> {
    try {
      // Step 1: Get only the N most recent run IDs for this measurement
      const runs = await this.getAnalysisRunsForMeasurement(measurementId)
      const recentRunIds = runs.slice(0, limit).map(r => r.id)
      if (recentRunIds.length === 0) return []

      // Step 2: Fetch attempts only for those runs (much fewer rows)
      const { data, error } = await this.supabase
        .from('ranking_attempts')
        .select('analysis_run_id, created_at, target_product_rank, success, llm_provider_id, llm_providers!inner(id, name, display_name)')
        .eq('measurement_id', measurementId)
        .in('analysis_run_id', recentRunIds)

      if (error) {
        console.error('[Service] getMeasurementRankingHistory: Error', error)
        throw new Error(`Failed to fetch ranking history: ${error.message}`)
      }

      // Build a created_at lookup from the runs we already have
      const runCreatedAt = new Map(runs.map(r => [r.id, r.created_at]))

      // Group by analysis_run_id
      const runStats = new Map<string, {
        created_at: string
        rankings: number[]
        total_attempts: number
        successful_attempts: number
        providerRankings: Map<string, { name: string, ranks: number[] }>
      }>()

      for (const attempt of (data || [])) {
        const runId = attempt.analysis_run_id
        if (!runStats.has(runId)) {
          runStats.set(runId, {
            created_at: runCreatedAt.get(runId) || attempt.created_at,
            rankings: [],
            total_attempts: 0,
            successful_attempts: 0,
            providerRankings: new Map()
          })
        }

        const stats = runStats.get(runId)!
        stats.total_attempts++

        if (attempt.success && attempt.target_product_rank != null) {
          stats.rankings.push(attempt.target_product_rank)
          stats.successful_attempts++

          const providerId = attempt.llm_provider_id
          const providerInfo = attempt.llm_providers as any
          const providerName = providerInfo?.display_name || providerInfo?.name || 'Unknown'
          if (!stats.providerRankings.has(providerId)) {
            stats.providerRankings.set(providerId, { name: providerName, ranks: [] })
          }
          stats.providerRankings.get(providerId)!.ranks.push(attempt.target_product_rank)
        }
      }

      return Array.from(runStats.entries())
        .map(([runId, stats]) => ({
          analysis_run_id: runId,
          created_at: stats.created_at,
          average_rank: stats.rankings.length > 0
            ? stats.rankings.reduce((a, b) => a + b, 0) / stats.rankings.length
            : null,
          best_rank: stats.rankings.length > 0 ? Math.min(...stats.rankings) : null,
          worst_rank: stats.rankings.length > 0 ? Math.max(...stats.rankings) : null,
          total_attempts: stats.total_attempts,
          successful_attempts: stats.successful_attempts,
          provider_breakdown: Array.from(stats.providerRankings.entries()).map(([pid, pdata]) => ({
            provider_id: pid,
            provider_name: pdata.name,
            average_rank: pdata.ranks.length > 0
              ? pdata.ranks.reduce((a, b) => a + b, 0) / pdata.ranks.length
              : null
          }))
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } catch (error) {
      console.error('[Service] getMeasurementRankingHistory: Error', error)
      return []
    }
  }
}
