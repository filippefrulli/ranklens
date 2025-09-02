import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ServerDatabaseService } from '$lib/server/database-service'

export const GET: RequestHandler = async ({ url, locals }) => {
  // Check authentication
  if (!locals.user || !locals.supabase) {
    throw error(401, 'Unauthorized')
  }

  try {
    const businessId = url.searchParams.get('businessId')
    
    if (!businessId) {
      throw error(400, 'businessId is required')
    }

    // Create database service with authenticated user context
    const dbService = new ServerDatabaseService(locals.supabase, locals.user.id)
    
    // Get most recent analysis (completed or failed) within last 30 seconds
    const { data: recentAnalysis } = await locals.supabase
      .from('analysis_runs')
      .select('*')
      .eq('business_id', businessId)
      .in('status', ['completed', 'failed'])
      .gte('completed_at', new Date(Date.now() - 30000).toISOString()) // Last 30 seconds
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    return json({ recentAnalysis })
    
  } catch (err) {
    console.error('API Error:', err)
    throw error(500, 'Internal server error')
  }
}
