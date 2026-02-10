import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { DatabaseService } from '../../../lib/services/database-service'

export const load: PageServerLoad = async ({ locals, params, url, depends }) => {
  const { supabase, session, user } = locals

  if (!session || !user) {
    console.log('[Load] Measurement detail: Unauthorized access attempt')
    throw error(401, 'Unauthorized')
  }

  const measurementId = params.id
  if (!measurementId) {
    console.log('[Load] Measurement detail: Missing measurement ID')
    throw error(404, 'Measurement not found')
  }

  depends('app:query-run-data')

  try {
    const dbService = new DatabaseService(supabase, user.id)

    // Get measurement details
    const measurement = await dbService.getMeasurement(measurementId)
    if (!measurement) {
      throw error(404, 'Measurement not found')
    }

    // Verify access — check if the measurement belongs to the user's product → company
    const product = await dbService.getProduct(measurement.product_id)
    if (!product) {
      throw error(403, 'Access denied')
    }

    // Validate product ownership
    const isOwner = await dbService.validateProductOwnership(product.id)
    if (!isOwner) {
      console.log('[Load] Measurement detail: Access denied', { measurementId })
      throw error(403, 'Access denied')
    }

    // Get analysis runs for this product
    const analysisRuns = await dbService.getAnalysisRunsForProduct(product.id)

    // Get LLM providers
    const llmProviders = await dbService.getActiveLLMProviders()

    // Get selected run from URL (or default to most recent)
    const selectedRunId = url.searchParams.get('run') || analysisRuns?.[0]?.id || null

    let rankingResults: any[] = []
    let competitorResults: any[] = []

    if (selectedRunId && measurementId) {
      try {
        // Fetch ranking attempts
        const { data: rankings, error: rankingsError } = await supabase
          .from('ranking_attempts')
          .select(`
            *,
            analysis_runs!inner(id, created_at),
            llm_providers!inner(id, name)
          `)
          .eq('measurement_id', measurementId)
          .eq('analysis_run_id', selectedRunId)
          .order('created_at', { ascending: false })

        if (rankingsError) {
          console.error('[Load] Measurement detail: Failed to fetch rankings', { error: rankingsError.message })
        } else {
          rankingResults = rankings || []
        }

        // Fetch competitor results
        const { data: competitorRows, error: competitorError } = await supabase
          .from('competitor_results')
          .select('*')
          .eq('measurement_id', measurementId)
          .eq('analysis_run_id', selectedRunId)
          .order('average_rank', { ascending: true })

        if (competitorError) {
          console.error('[Load] Measurement detail: Failed to fetch competitors', { error: competitorError.message })
        } else {
          competitorResults = competitorRows || []
        }
      } catch (err: any) {
        console.error('[Load] Measurement detail: Error loading run data', {
          measurementId,
          selectedRunId,
          error: err?.message
        })
      }
    }

    return {
      query: measurement,
      product,
      analysisRuns: analysisRuns || [],
      llmProviders,
      selectedRunId,
      rankingResults,
      competitorResults,
      user
    }
  } catch (err: any) {
    // Re-throw HttpError
    if (err?.status) throw err
    console.error('[Load] Measurement detail: Error', { measurementId: params.id, error: err?.message })
    throw error(500, 'Failed to load measurement data')
  }
}
