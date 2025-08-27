import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ServerAnalysisService } from '$lib/server/analysis-service'

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

    // Create analysis service with authenticated user context
    const analysisService = new ServerAnalysisService(locals.supabase, locals.user.id)
    
    // Get analysis status (RLS will ensure user can only access their own business data)
    const runningAnalysis = await analysisService.getAnalysisStatus(businessId)
    
    return json({ runningAnalysis })
    
  } catch (err) {
    console.error('API Error:', err)
    throw error(500, 'Internal server error')
  }
}
