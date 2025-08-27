import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ServerAnalysisService } from '$lib/server/analysis-service'

export const POST: RequestHandler = async ({ request, locals }) => {
  // Check authentication
  if (!locals.user || !locals.supabase) {
    throw error(401, 'Unauthorized')
  }

  try {
    const { businessId } = await request.json()
    
    if (!businessId) {
      throw error(400, 'Missing businessId')
    }

    // Create analysis service with authenticated user context
    const analysisService = new ServerAnalysisService(locals.supabase, locals.user.id)
    
    // Run analysis (RLS will ensure user can only analyze their own business)
    const result = await analysisService.runAnalysis(businessId)
    
    return json(result)
    
  } catch (err) {
    console.error('API Error:', err)
    
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      throw error(403, err.message)
    }
    
    throw error(500, 'Internal server error')
  }
}
