import { LLMService } from './llm-service'
import { DatabaseService } from './database-service'
import type { Product, Measurement, LLMProvider, AnalysisRun } from '../types'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

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
   * Run complete analysis for a product (scoped to product, not company).
   */
  async runAnalysis(productId: string): Promise<{ success: boolean; analysisRunId?: string; error?: string }> {
    console.log(`[Action] runAnalysis: Starting for product ${productId}`)

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

      // Get measurements
      const measurements = await this.dbService.getMeasurementsForProduct(productId)
      if (measurements.length === 0) {
        console.error(`[Action] runAnalysis: No measurements for product "${product.name}"`)
        return { success: false, error: 'No measurements found for this product' }
      }

      // Get active providers
      const providers = await this.dbService.getActiveLLMProviders()
      if (providers.length === 0) {
        console.error('[Action] runAnalysis: No active LLM providers')
        return { success: false, error: 'No active LLM providers found' }
      }

      // Create analysis run
      const analysisRun = await this.dbService.createAnalysisRun(productId, measurements.length)

      const totalCalls = measurements.length * providers.length * ATTEMPTS_PER_MEASUREMENT
      console.log(`[Action] runAnalysis: Setup complete for "${product.name}": ${measurements.length} measurements × ${providers.length} providers × ${ATTEMPTS_PER_MEASUREMENT} attempts = ${totalCalls} total LLM calls`)

      // Create a cookie-less background Supabase client
      let backgroundDb = this.dbService
      try {
        const { data: { session } } = await this.supabase.auth.getSession()
        const accessToken = session?.access_token
        const backgroundSupabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
          }
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
   * Background analysis execution — 10 attempts per measurement per provider.
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

      await db.updateAnalysisRun(analysisRun.id, { total_llm_calls: totalCalls })

      for (let mIdx = 0; mIdx < measurements.length; mIdx++) {
        const measurement = measurements[mIdx]
        const rankingAttempts: any[] = []

        for (const provider of providers) {
          for (let attemptNum = 1; attemptNum <= ATTEMPTS_PER_MEASUREMENT; attemptNum++) {
            try {
              const result = await LLMService.makeRequest(provider, measurement.query, product.name, 25)
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

              if (completedCalls % 5 === 0 || completedCalls === totalCalls) {
                try {
                  await db.updateAnalysisRun(analysisRun.id, { completed_llm_calls: completedCalls })
                } catch (e) {
                  console.warn(`[Service] Failed to update progress (${completedCalls}/${totalCalls}):`, e instanceof Error ? e.message : e)
                }
              }

              if (attemptNum < ATTEMPTS_PER_MEASUREMENT) {
                await new Promise(resolve => setTimeout(resolve, 1000))
              }
            } catch (err) {
              console.error(`[Service] Error in ${provider.name} attempt ${attemptNum}:`, err)
              completedCalls++

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

              if (completedCalls % 5 === 0 || completedCalls === totalCalls) {
                try {
                  await db.updateAnalysisRun(analysisRun.id, { completed_llm_calls: completedCalls })
                } catch {}
              }

              // Auth errors → skip remaining attempts for this provider
              if (errorMessage.toLowerCase().includes('api key') ||
                  errorMessage.toLowerCase().includes('unauthorized') ||
                  errorMessage.toLowerCase().includes('authentication')) {
                console.warn(`[Service] ${provider.name} auth issue — skipping remaining attempts`)
                for (let skip = attemptNum + 1; skip <= ATTEMPTS_PER_MEASUREMENT; skip++) {
                  completedCalls++
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
                try {
                  await db.updateAnalysisRun(analysisRun.id, { completed_llm_calls: completedCalls })
                } catch {}
                break
              }
            }
          }

          // Delay between providers
          await new Promise(resolve => setTimeout(resolve, 2000))
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
      try {
        const count = await db.populateCompetitorResultsForAnalysisRun(analysisRun.id)
        const duration = Math.round((Date.now() - startTime) / 1000)
        console.log(`[Service] ANALYSIS COMPLETED for "${product.name}" in ${duration}s — ${successfulCalls}/${totalCalls} successful, ${count} competitor results`)
      } catch (e) {
        console.error('[Service] Failed to populate competitor results:', e instanceof Error ? e.message : e)
        const duration = Math.round((Date.now() - startTime) / 1000)
        console.log(`[Service] ANALYSIS COMPLETED for "${product.name}" in ${duration}s (competitor results failed)`)
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
   * Get currently running analysis for a product.
   */
  async getAnalysisStatus(productId: string): Promise<AnalysisRun | null> {
    return await this.dbService.getRunningAnalysisForProduct(productId)
  }
}
