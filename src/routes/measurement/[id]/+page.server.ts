import { error, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { DatabaseService } from '$lib/services/database-service'
import { AnalysisService } from '$lib/services/analysis-service'

export const load: PageServerLoad = async ({ locals, params, url, depends }) => {
  const { supabase, session, user } = locals

  if (!session || !user) {
    throw error(401, 'Unauthorized')
  }

  const measurementId = params.id
  if (!measurementId) {
    throw error(404, 'Measurement not found')
  }

  depends('app:measurement-data')

  try {
    const dbService = new DatabaseService(supabase, user.id)

    const measurement = await dbService.getMeasurement(measurementId)
    if (!measurement) {
      throw error(404, 'Measurement not found')
    }

    // RLS ensures only the owner can read their products — no separate ownership check needed
    const product = await dbService.getProduct(measurement.product_id)
    if (!product) {
      throw error(403, 'Access denied')
    }

    // Get analysis runs that have data for this measurement
    const analysisRuns = await dbService.getAnalysisRunsForMeasurement(measurementId)

    // Get LLM providers
    const llmProviders = await dbService.getActiveLLMProviders()

    // Get selected run from URL (or default to most recent)
    const selectedRunId = url.searchParams.get('run') || analysisRuns?.[0]?.id || null

    let rankingResults: any[] = []
    let competitorResults: any[] = []

    if (selectedRunId) {
      try {
        const { data: rankings, error: rankingsError } = await supabase
          .from('ranking_attempts')
          .select(`
            *,
            analysis_runs!inner(id, created_at),
            llm_providers!inner(id, name, display_name)
          `)
          .eq('measurement_id', measurementId)
          .eq('analysis_run_id', selectedRunId)
          .order('created_at', { ascending: false })

        if (!rankingsError) rankingResults = rankings || []

        const { data: competitors, error: competitorError } = await supabase
          .from('competitor_results')
          .select('*')
          .eq('measurement_id', measurementId)
          .eq('analysis_run_id', selectedRunId)
          .order('average_rank', { ascending: true })

        if (!competitorError) competitorResults = competitors || []
      } catch (err: any) {
        console.error('[Load] Measurement detail: Error loading run data', { error: err?.message })
      }
    }

    const sourceCitations = selectedRunId
      ? await dbService.getSourceCitationsForRun(selectedRunId, measurementId)
      : []

    // Get ranking history for the History tab
    const rankingHistory = await dbService.getMeasurementRankingHistory(measurementId, 20)

    // Check for running analysis
    const analysisService = new AnalysisService(supabase, user.id)
    const runningAnalysis = await analysisService.getAnalysisStatus(product.id)

    return {
      measurement,
      product,
      analysisRuns: analysisRuns || [],
      llmProviders,
      selectedRunId,
      rankingResults,
      competitorResults,
      rankingHistory,
      runningAnalysis,
      sourceCitations,
      user
    }
  } catch (err: any) {
    if (err?.status) throw err
    console.error('[Load] Measurement detail: Error', { measurementId: params.id, error: err?.message })
    throw error(500, 'Failed to load measurement data')
  }
}

export const actions: Actions = {
  runAnalysis: async ({ locals, params }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const measurementId = params.id

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const measurement = await dbService.getMeasurement(measurementId)
      if (!measurement) {
        return fail(404, { error: 'Measurement not found' })
      }

      const isOwner = await dbService.validateProductOwnership(measurement.product_id)
      if (!isOwner) {
        return fail(403, { error: 'Access denied' })
      }

      const analysisService = new AnalysisService(locals.supabase, locals.user.id)
      const result = await analysisService.runAnalysis(measurement.product_id, measurementId)

      if (!result.success) {
        return fail(500, { error: result.error || 'Failed to start analysis' })
      }

      return { success: true, analysisRunId: result.analysisRunId }
    } catch (err: any) {
      console.error('[Action] runAnalysis: Error', { error: err?.message })
      return fail(500, { error: 'Failed to run analysis' })
    }
  }
}
