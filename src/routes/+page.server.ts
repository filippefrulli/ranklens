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
