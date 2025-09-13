import type { PageServerLoad, Actions } from './$types'
import { fail } from '@sveltejs/kit'
import { DatabaseService } from '$lib/services/database-service'
import { QuerySuggestionService } from '$lib/services/query-suggestion-service'
import { AnalysisService } from '$lib/services/analysis-service'

export const load: PageServerLoad = async ({ locals }) => {
  // If user is not authenticated, return minimal data
  if (!locals.user || !locals.supabase) {
    return {
      user: null
    }
  }

  try {
    // Create database service with authenticated context
    const dbService = new DatabaseService(locals.supabase, locals.user.id)
    
    // Try to get business - if none exists, user needs onboarding
    const business = await dbService.getBusiness()
    
    if (!business) {
      return {
        user: locals.user,
        business: null,
        needsOnboarding: true
      }
    }

    // Load all dashboard data
    const queries = await dbService.getQueriesForBusiness(business.id)
    const weeklyCheck = await dbService.checkWeeklyAnalysis(business.id)
    const llmProviders = await dbService.getActiveLLMProviders()
    
    // Load query histories for each query
    const queryHistories: Record<string, any[]> = {}
    for (const query of queries) {
      try {
        queryHistories[query.id] = await dbService.getQueryRankingHistory(query.id, 10)
      } catch (error) {
        console.error(`Failed to load history for query ${query.id}:`, error)
        queryHistories[query.id] = []
      }
    }
    
    // Create analysis service to get status
    const analysisService = new AnalysisService(locals.supabase, locals.user.id)
    const runningAnalysis = await analysisService.getAnalysisStatus(business.id)

    return {
      user: locals.user,
      business,
      queries,
      queryHistories,
      weeklyCheck,
      runningAnalysis,
      llmProviders
    }
  } catch (err) {
    console.error('Error loading dashboard data:', err)
    return {
      user: locals.user,
      business: null,
      error: 'Failed to load dashboard data'
    }
  }
}

export const actions: Actions = {
  // Create business action
  createBusiness: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    try {
      const formData = await request.formData()
      const name = formData.get('name') as string
      const googlePlaceId = formData.get('google_place_id') as string
      const city = formData.get('city') as string
      const googlePrimaryTypeDisplay = formData.get('google_primary_type_display') as string

      if (!name || !googlePlaceId) {
        return fail(400, { error: 'Business name and Google Place ID are required' })
      }

      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      
      const business = await dbService.createBusiness({
        name,
        google_place_id: googlePlaceId,
        city,
        google_primary_type_display: googlePrimaryTypeDisplay
      })

      return { success: true, business }

    } catch (err) {
      console.error('Error creating business:', err)
      return fail(500, { error: 'Failed to create business' })
    }
  },

  // Generate query suggestions action
  generateQuerySuggestions: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const business = await dbService.getBusiness()
      
      if (!business) {
        return fail(404, { error: 'Business not found' })
      }

      const suggestions = await QuerySuggestionService.generateQuerySuggestions(business)

      return { 
        suggestions: suggestions.map(s => s.text) // Return just the text array
      }

    } catch (err) {
      console.error('Error generating query suggestions:', err)
      return fail(500, { error: 'Failed to generate query suggestions' })
    }
  }
}
