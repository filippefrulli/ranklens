import { LLMService } from './llm-service'
import { DatabaseService } from './database-service'
import type { Product, Measurement, LLMProvider, AnalysisRun } from '../types'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { env } from '$env/dynamic/private'

const ATTEMPTS_PER_MEASUREMENT = 10

export class AnalysisService {
  private dbService: DatabaseService
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.dbService = new DatabaseService(supabase, userId)
  }

  /**
   * Run analysis for a single measurement.
   */
  async runAnalysis(productId: string, measurementId: string): Promise<{ success: boolean; analysisRunId?: string; error?: string }> {
    console.log(`[Action] runAnalysis: Starting for measurement ${measurementId} (product ${productId})`)

    try {
      // Validate ownership
      const isOwner = await this.dbService.validateProductOwnership(productId)
      if (!isOwner) {
        console.error(`[Action] runAnalysis: Unauthorized for product ${productId}`)
        return { success: false, error: 'Unauthorized: Product not found or access denied' }
      }

      // Get product data
      const product = await this.dbService.getProduct(productId)
      if (!product) {
        console.error(`[Action] runAnalysis: Product not found ${productId}`)
        return { success: false, error: 'Product not found' }
      }

      // Get the specific measurement
      const measurement = await this.dbService.getMeasurement(measurementId)
      if (!measurement) {
        console.error(`[Action] runAnalysis: Measurement not found ${measurementId}`)
        return { success: false, error: 'Measurement not found' }
      }
      const measurements = [measurement]

      // Get active providers
      const providers = await this.dbService.getActiveLLMProviders()
      if (providers.length === 0) {
        console.error('[Action] runAnalysis: No active LLM providers')
        return { success: false, error: 'No active LLM providers found' }
      }

      // Create analysis run
      const analysisRun = await this.dbService.createAnalysisRun(productId, measurementId, 1)

      const totalCalls = providers.length * ATTEMPTS_PER_MEASUREMENT
      console.log(`[Action] runAnalysis: Setup complete for "${product.name}" / "${measurement.title}": ${providers.length} providers × ${ATTEMPTS_PER_MEASUREMENT} attempts = ${totalCalls} total LLM calls`)

      // Create a background Supabase client using the secret key (bypasses RLS, never expires)
      let backgroundDb = this.dbService
      try {
        const secretKey = env.SUPABASE_PRIVATE_KEY
        if (!secretKey) throw new Error('SUPABASE_PRIVATE_KEY not configured')
        const backgroundSupabase = createClient(PUBLIC_SUPABASE_URL, secretKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        })
        backgroundDb = new DatabaseService(backgroundSupabase as any, this.userId)
      } catch (e) {
        console.warn('[Action] runAnalysis: Failed to init background client, using request-bound:', e)
      }

      // Fire-and-forget background analysis
      this.runAnalysisInBackground(analysisRun, product, measurements, providers, backgroundDb)

      return { success: true, analysisRunId: analysisRun.id }
    } catch (err) {
      console.error('[Action] runAnalysis: Error', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to start analysis'
      }
    }
  }

  /**
   * Background analysis execution — 10 attempts per provider, all providers in parallel.
   * Standardization runs once at the end on all unique business names.
   */
  private async runAnalysisInBackground(
    analysisRun: AnalysisRun,
    product: Product,
    measurements: Measurement[],
    providers: LLMProvider[],
    db: DatabaseService
  ) {
    const startTime = Date.now()
    console.log(`[Service] Background analysis started for "${product.name}"`)

    try {
      let completedCalls = 0
      const totalCalls = measurements.length * providers.length * ATTEMPTS_PER_MEASUREMENT
      let successfulCalls = 0
      let failedCalls = 0

      await db.updateAnalysisRun(analysisRun.id, {
        status: 'running',
        started_at: new Date().toISOString(),
        total_llm_calls: totalCalls
      })

      for (let mIdx = 0; mIdx < measurements.length; mIdx++) {
        const measurement = measurements[mIdx]
        const rankingAttempts: any[] = []

        // Run all providers in parallel, each running its attempts sequentially
        const providerTasks = providers.map(provider => (async () => {
          for (let attemptNum = 1; attemptNum <= ATTEMPTS_PER_MEASUREMENT; attemptNum++) {
            try {
              const result = await LLMService.makeRequestRaw(provider, measurement.query, product.name, 25)
              completedCalls++
              if (result.success) successfulCalls++
              else failedCalls++

              rankingAttempts.push({
                analysis_run_id: analysisRun.id,
                measurement_id: measurement.id,
                llm_provider_id: provider.id,
                attempt_number: attemptNum,
                parsed_ranking: result.rankedBusinesses || [],
                target_product_rank: result.foundBusinessRank,
                success: result.success,
                error_message: result.error || null,
              })

              // Update progress periodically
              if (completedCalls % 5 === 0 || completedCalls === totalCalls) {
                try {
                  await db.updateAnalysisRun(analysisRun.id, { completed_llm_calls: completedCalls })
                } catch (e) {
                  console.warn(`[Service] Failed to update progress (${completedCalls}/${totalCalls}):`, e instanceof Error ? e.message : e)
                }
              }
            } catch (err) {
              console.error(`[Service] Error in ${provider.name} attempt ${attemptNum}:`, err)
              completedCalls++
              failedCalls++

              const errorMessage = err instanceof Error ? err.message : String(err)
              rankingAttempts.push({
                analysis_run_id: analysisRun.id,
                measurement_id: measurement.id,
                llm_provider_id: provider.id,
                attempt_number: attemptNum,
                parsed_ranking: [],
                target_product_rank: null,
                success: false,
                error_message: errorMessage,
              })

              // Auth errors → skip remaining attempts for this provider
              if (errorMessage.toLowerCase().includes('api key') ||
                  errorMessage.toLowerCase().includes('unauthorized') ||
                  errorMessage.toLowerCase().includes('authentication')) {
                console.warn(`[Service] ${provider.name} auth issue — skipping remaining attempts`)
                for (let skip = attemptNum + 1; skip <= ATTEMPTS_PER_MEASUREMENT; skip++) {
                  completedCalls++
                  failedCalls++
                  rankingAttempts.push({
                    analysis_run_id: analysisRun.id,
                    measurement_id: measurement.id,
                    llm_provider_id: provider.id,
                    attempt_number: skip,
                    parsed_ranking: [],
                    target_product_rank: null,
                    success: false,
                    error_message: `Skipped due to authentication error: ${errorMessage}`,
                  })
                }
                break
              }
            }
          }
        })())

        // Wait for all providers to finish
        await Promise.all(providerTasks)

        // Post-process: standardize all business names from successful attempts in one batch
        const allRawNames = new Set<string>()
        for (const attempt of rankingAttempts) {
          if (attempt.success && attempt.parsed_ranking) {
            for (const name of attempt.parsed_ranking) {
              allRawNames.add(name)
            }
          }
        }

        if (allRawNames.size > 0) {
          try {
            const uniqueNames = Array.from(allRawNames)
            const standardized = await LLMService.standardizeBusinessNames(uniqueNames, product.name)
            // Build mapping from raw → standardized
            const nameMap = new Map<string, string>()
            for (let i = 0; i < uniqueNames.length && i < standardized.length; i++) {
              nameMap.set(uniqueNames[i], standardized[i])
            }
            // Apply standardization to all attempts
            for (const attempt of rankingAttempts) {
              if (attempt.success && attempt.parsed_ranking) {
                attempt.parsed_ranking = attempt.parsed_ranking.map(
                  (name: string) => nameMap.get(name) || name
                )
              }
            }
            console.log(`[Service] Standardized ${uniqueNames.length} unique names across ${rankingAttempts.length} attempts`)
          } catch (e) {
            console.warn('[Service] Post-processing standardization failed, keeping raw names:', e instanceof Error ? e.message : e)
          }
        }

        // Save ranking attempts for this measurement
        if (rankingAttempts.length > 0) {
          try {
            await db.saveRankingAttempts(rankingAttempts)
          } catch (e) {
            console.warn(`[Service] Failed to save ranking attempts for measurement "${measurement.title}":`, e instanceof Error ? e.message : e)
          }
        }

        // Update completed measurements
        try {
          await db.updateAnalysisRun(analysisRun.id, { completed_measurements: mIdx + 1 })
        } catch {}
      }

      // Mark completed
      try {
        await db.updateAnalysisRun(analysisRun.id, {
          status: 'completed',
          completed_measurements: measurements.length,
          completed_llm_calls: totalCalls,
          completed_at: new Date().toISOString()
        })
      } catch (e) {
        console.warn('[Service] Failed to mark analysis as completed:', e instanceof Error ? e.message : e)
      }

      // Populate competitor results
      let competitorCount = 0
      try {
        competitorCount = await db.populateCompetitorResultsForAnalysisRun(analysisRun.id)
        const duration = Math.round((Date.now() - startTime) / 1000)
        console.log(`[Service] ANALYSIS COMPLETED for "${product.name}" in ${duration}s — ${successfulCalls}/${totalCalls} successful, ${competitorCount} competitor results`)
      } catch (e) {
        console.error('[Service] Failed to populate competitor results:', e instanceof Error ? e.message : e)
        const duration = Math.round((Date.now() - startTime) / 1000)
        console.log(`[Service] ANALYSIS COMPLETED for "${product.name}" in ${duration}s (competitor results failed)`)
      }

      // Collect sources for target + competitors ranked above target (fire-and-forget)
      if (competitorCount > 0 && measurements.length > 0) {
        for (const measurement of measurements) {
          this.collectSourcesForRun(analysisRun.id, measurement, product.name, db).catch((e) => {
            console.warn(`[Service] Source collection failed for measurement "${measurement.title}":`, e instanceof Error ? e.message : e)
          })
        }
      }
    } catch (err) {
      const duration = Math.round((Date.now() - startTime) / 1000)
      console.error(`[Service] ANALYSIS FAILED for "${product.name}" after ${duration}s:`, err instanceof Error ? err.message : err)

      try {
        await db.updateAnalysisRun(analysisRun.id, {
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
      } catch {}
    }
  }

  /**
   * Collect online sources for the target product and competitors ranked above it.
   * Uses Gemini with Google Search grounding. Non-blocking — errors are swallowed.
   */
  private async collectSourcesForRun(
    analysisRunId: string,
    measurement: Measurement,
    targetProductName: string,
    db: DatabaseService
  ): Promise<void> {
    console.log(`[Service] collectSourcesForRun: starting for measurement "${measurement.title}"`)

    const results = await db.getCompetitorResultsForRun(analysisRunId, measurement.id)

    if (results.length === 0) {
      console.warn('[Service] collectSourcesForRun: no competitor results found')
      return
    }

    const targetRow = results.find((r) => r.is_target)
    const targetRank: number = targetRow?.average_rank ?? Infinity

    // Competitors ranked strictly above the target (lower average_rank = better)
    const competitorsAbove = results
      .filter((r) => !r.is_target && r.average_rank != null && r.average_rank < targetRank)
      .sort((a, b) => (a.average_rank ?? 0) - (b.average_rank ?? 0))
      .slice(0, 5)

    const productsToFetch: Array<{ name: string; isTarget: boolean }> = [
      ...(targetRow ? [{ name: targetProductName, isTarget: true }] : []),
      ...competitorsAbove.map((r) => ({ name: r.product_name, isTarget: false }))
    ]

    const allCitations: Array<Omit<import('../types').SourceCitation, 'id' | 'created_at'>> = []

    // Fetch sequentially to avoid rate-limiting Gemini grounding
    for (const p of productsToFetch) {
      const sources = await LLMService.fetchSourcesForProduct(p.name, measurement.query)
      for (const src of sources) {
        allCitations.push({
          analysis_run_id: analysisRunId,
          measurement_id: measurement.id,
          product_name: p.name,
          is_target: p.isTarget,
          url: src.url,
          title: src.title,
          snippet: src.snippet || undefined
        })
      }
    }

    if (allCitations.length > 0) {
      await db.saveSourceCitations(allCitations)
      console.log(`[Service] collectSourcesForRun: saved ${allCitations.length} citations for "${measurement.title}"`)
    } else {
      console.log(`[Service] collectSourcesForRun: no citations found for "${measurement.title}"`)
    }
  }

  /**
   * Get currently running analysis for a specific measurement.
   */
  async getAnalysisStatus(measurementId: string): Promise<AnalysisRun | null> {
    return await this.dbService.getRunningAnalysisForMeasurement(measurementId)
  }
}
