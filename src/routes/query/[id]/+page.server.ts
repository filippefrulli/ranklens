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
    // Get query details with authenticated supabase client
    const queryData = await DatabaseService.getQuery(supabase, queryId)
    if (!queryData) {
      throw error(404, 'Query not found')
    }

    // Verify access - check if the query belongs to the user's business
    const business = await DatabaseService.getBusiness(supabase, user.id)
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
    const llmProviders = await DatabaseService.getLLMProviders(supabase)

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