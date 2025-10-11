import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { DatabaseService } from '../../../lib/services/database-service'

export const load: PageServerLoad = async ({ locals, params, url, depends }) => {
  const { supabase, session, user } = locals

  if (!session || !user) {
    console.log('[Load] Query detail: Unauthorized access attempt')
    throw error(401, 'Unauthorized')
  }

  const queryId = params.id
  if (!queryId) {
    console.log('[Load] Query detail: Missing query ID')
    throw error(404, 'Query not found')
  }

  // Track dependency for run data invalidation
  depends('app:query-run-data')

  try {
    // Create database service with authenticated context
    const dbService = new DatabaseService(supabase, user.id)
    
    // Get query details
    const queryData = await dbService.getQuery(queryId)
    if (!queryData) {
      throw error(404, 'Query not found')
    }

    // Verify access - check if the query belongs to the user's business
    const business = await dbService.getBusiness()
    if (!business || queryData.business_id !== business.id) {
      console.log('[Load] Query detail: Access denied', { queryId })
      throw error(403, 'Access denied')
    }

    // Get analysis runs for this query
    const { data: analysisRuns, error: runsError } = await supabase
      .from('analysis_runs')
      .select('id, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })

    if (runsError) {
      throw new Error(`Failed to fetch analysis runs: ${runsError.message}`)
    }

    // Get LLM providers
    const llmProviders = await dbService.getActiveLLMProviders()

    // Get selected run from URL (or default to most recent)
    const selectedRunId = url.searchParams.get('run') || analysisRuns?.[0]?.id || null
    
    let rankingResults: any[] = []
    let competitorResults: any[] = []

    // Load run data if a run is selected
    if (selectedRunId && queryId) {
      try {
        // Fetch ranking attempts
        const { data: rankings, error: rankingsError } = await supabase
          .from('ranking_attempts')
          .select(`
            *,
            analysis_runs!inner(id, created_at),
            llm_providers!inner(id, name)
          `)
          .eq('query_id', queryId)
          .eq('analysis_run_id', selectedRunId)
          .order('created_at', { ascending: false })

        if (rankingsError) {
          console.error('[Load] Query detail: Failed to fetch rankings', { error: rankingsError.message })
        } else {
          rankingResults = rankings || []
        }

        // Fetch competitor results
        const { data: competitorRows, error: competitorError } = await supabase
          .from('competitor_results')
          .select('*')
          .eq('query_id', queryId)
          .eq('analysis_run_id', selectedRunId)
          .order('average_rank', { ascending: true })

        if (competitorError) {
          console.error('[Load] Query detail: Failed to fetch competitors', { error: competitorError.message })
        } else {
          competitorResults = competitorRows || []
        }
      } catch (err: any) {
        console.error('[Load] Query detail: Error loading run data', { 
          queryId, 
          selectedRunId, 
          error: err?.message 
        })
      }
    }

    return {
      query: queryData,
      business,
      analysisRuns: analysisRuns || [],
      llmProviders,
      selectedRunId,
      rankingResults,
      competitorResults
    }
  } catch (err: any) {
    console.error('[Load] Query detail: Error', { queryId: params.id, error: err?.message || 'Unknown error' })
    throw error(500, 'Failed to load query data')
  }
}