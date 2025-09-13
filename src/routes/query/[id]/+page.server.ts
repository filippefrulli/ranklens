import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { DatabaseService } from '../../../lib/services/database-service'

export const load: PageServerLoad = async ({ locals, params }) => {
  const { supabase, session, user } = locals

  if (!session || !user) {
    throw error(401, 'Unauthorized')
  }

  const queryId = params.id
  if (!queryId) {
    throw error(404, 'Query not found')
  }

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

    return {
      query: queryData,
      business,
      analysisRuns: analysisRuns || [],
      llmProviders
    }
  } catch (err) {
    console.error('Error loading query data:', err)
    throw error(500, 'Failed to load query data')
  }
}