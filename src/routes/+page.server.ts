import type { PageServerLoad, Actions } from './$types'
import { fail, redirect } from '@sveltejs/kit'
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
    
    // Don't auto-generate suggestions - let user trigger them manually
    const querySuggestions: string[] = []
    
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
      llmProviders,
      querySuggestions
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
    console.log('createBusiness action called')
    
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const googlePlaceId = formData.get('google_place_id') as string
    const city = formData.get('city') as string
    const googlePrimaryTypeDisplay = formData.get('google_primary_type_display') as string

    console.log('Creating business:', { name, googlePlaceId, city, googlePrimaryTypeDisplay })

    if (!name || !googlePlaceId) {
      return fail(400, { error: 'Business name and Google Place ID are required' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      
      const business = await dbService.createBusiness({
        name,
        google_place_id: googlePlaceId,
        city,
        google_primary_type_display: googlePrimaryTypeDisplay
      })

      console.log('Business created successfully, redirecting...')
      
    } catch (err) {
      console.error('Error creating business:', err)
      return fail(500, { error: 'Failed to create business' })
    }

    // Redirect to home page with clean URL after successful creation
    throw redirect(303, '/')
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
  },

  // Add query action
  addQuery: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const formData = await request.formData()
    const queryText = formData.get('query') as string

    if (!queryText || queryText.trim().length === 0) {
      return fail(400, { error: 'Query text is required' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const business = await dbService.getBusiness()
      
      if (!business) {
        return fail(404, { error: 'Business not found' })
      }

      // Check if query already exists for this business
      const existingQueries = await dbService.getQueriesForBusiness(business.id)
      const duplicateQuery = existingQueries.find(q => 
        q.text.toLowerCase().trim() === queryText.toLowerCase().trim()
      )

      if (duplicateQuery) {
        return fail(400, { error: 'This query already exists' })
      }

      const query = await dbService.createQuery({
        business_id: business.id,
        text: queryText.trim()
      })

      return { 
        success: true,
        query
      }

    } catch (err) {
      console.error('Error adding query:', err)
      return fail(500, { error: 'Failed to add query' })
    }
  }
}
