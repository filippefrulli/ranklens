import type { PageServerLoad, Actions } from './$types'
import { fail, redirect } from '@sveltejs/kit'
import { DatabaseService } from '$lib/services/database-service'
import { AnalysisService } from '$lib/services/analysis-service'
import { QuerySuggestionService } from '$lib/services/query-suggestion-service'

export const load: PageServerLoad = async ({ locals, url }) => {
  // Ensure user is authenticated
  if (!locals.user || !locals.supabase) {
    throw redirect(302, '/auth')
  }

  try {
    // Create database service with authenticated context
    const dbService = new DatabaseService(locals.supabase, locals.user.id)
    
    // Ensure required providers are active
    await dbService.ensureRequiredProvidersActive()
    
    // Load all dashboard data on the server
    const business = await dbService.getBusiness()
    if (!business) {
      throw redirect(302, '/onboarding')
    }

    const queries = await dbService.getQueriesForBusiness(business.id)
    const weeklyCheck = await dbService.checkWeeklyAnalysis(business.id)
    
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
      business,
      queries,
      queryHistories,
      weeklyCheck,
      runningAnalysis,
      user: locals.user
    }
  } catch (err) {
    console.error('Error loading dashboard data:', err)
    return fail(500, { error: 'Failed to load dashboard data' })
  }
}

export const actions: Actions = {
  // Run analysis action
  runAnalysis: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      console.log('[Action] runAnalysis: Unauthorized attempt')
      return fail(401, { error: 'Unauthorized' })
    }

    const formData = await request.formData()
    const businessId = formData.get('businessId') as string

    if (!businessId) {
      console.log('[Action] runAnalysis: Missing business ID')
      return fail(400, { error: 'Business ID is required' })
    }

    try {
      console.log('[Action] runAnalysis: Starting analysis', { businessId })
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const business = await dbService.getBusiness()
      
      if (!business || business.id !== businessId) {
        console.log('[Action] runAnalysis: Business not found', { businessId })
        return fail(404, { error: 'Business not found or access denied' })
      }

      // Check if analysis can be run (weekly check)
      const weeklyCheck = await dbService.checkWeeklyAnalysis(business.id)
      if (!weeklyCheck.canRun) {
        console.log('[Action] runAnalysis: Weekly limit reached', { businessId })
        return fail(400, { 
          error: `Analysis was already run this week. Next run available: ${weeklyCheck.nextAllowedDate ? new Date(weeklyCheck.nextAllowedDate).toLocaleDateString() : 'next week'}` 
        })
      }

      // Start the analysis
      const analysisService = new AnalysisService(locals.supabase, locals.user.id)
      const result = await analysisService.runAnalysis(business.id)

      if (!result.success) {
        console.error('[Action] runAnalysis: Analysis failed', { businessId, error: result.error })
        return fail(500, { error: result.error || 'Failed to start analysis' })
      }

      console.log('[Action] runAnalysis: Success', { businessId, analysisRunId: result.analysisRunId })
      return { 
        success: true,
        analysisRunId: result.analysisRunId
      }

    } catch (err: any) {
      console.error('[Action] runAnalysis: Exception', { businessId, error: err?.message || 'Unknown error' })
      return fail(500, { error: 'Failed to run analysis' })
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
      console.error('[Action] addQuery: Error', { error: err })
      return fail(500, { error: 'Failed to add query' })
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
      console.error('[Action] generateQuerySuggestions: Error', { error: err })
      return fail(500, { error: 'Failed to generate query suggestions' })
    }
  }
}
