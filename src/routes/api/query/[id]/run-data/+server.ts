import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const { supabase, user } = locals

  if (!user) {
    throw error(401, 'Unauthorized')
  }

  const queryId = params.id
  const runId = url.searchParams.get('runId')

  if (!queryId || !runId) {
    throw error(400, 'Missing required parameters')
  }

  try {
    // First verify the user owns the query through their business
    const { data: queryData } = await supabase
      .from('queries')
      .select('id, business:businesses!inner(user_id)')
      .eq('id', queryId)
      .single()

    if (!queryData || queryData.business.user_id !== user.id) {
      throw error(403, 'Access denied')
    }

    // Fetch ranking attempts
    const { data: rankings, error: rankingsError } = await supabase
      .from('ranking_attempts')
      .select(`
        *,
        analysis_runs!inner(id, created_at),
        llm_providers!inner(id, name)
      `)
      .eq('query_id', queryId)
      .eq('analysis_run_id', runId)
      .order('created_at', { ascending: false })

    if (rankingsError) {
      throw new Error('Failed to fetch ranking results')
    }

    // Fetch competitor results
    const { data: competitorRows, error: competitorError } = await supabase
      .from('competitor_results')
      .select('*')
      .eq('query_id', queryId)
      .eq('analysis_run_id', runId)
      .order('average_rank', { ascending: true })

    if (competitorError) {
      throw new Error('Failed to fetch competitor rankings')
    }

    return json({
      rankingResults: rankings || [],
      competitorResults: competitorRows || []
    })
  } catch (e: any) {
    throw error(500, 'Failed to load run data')
  }
}
