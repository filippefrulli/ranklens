import type { PageServerLoad, Actions } from './$types'
import { error, fail, redirect } from '@sveltejs/kit'
import { DatabaseService } from '$lib/services/database-service'
import { AnalysisService } from '$lib/services/analysis-service'

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
      return fail(401, { error: 'Unauthorized' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const business = await dbService.getBusiness()
      if (!business) {
        return fail(404, { error: 'Business not found' })
      }

      // Check if analysis can be run
      const weeklyCheck = await dbService.checkWeeklyAnalysis(business.id)
      if (!weeklyCheck.canRun) {
        return fail(400, { error: 'Weekly analysis already completed' })
      }

      // Start the analysis
      const analysisService = new AnalysisService(locals.supabase, locals.user.id)
      const result = await analysisService.runAnalysis(business.id)
      
      if (!result.success) {
        return fail(400, { error: result.error })
      }

      return { success: true, analysisRunId: result.analysisRunId }

    } catch (err) {
      console.error('Error starting analysis:', err)
      return fail(500, { error: 'Failed to start analysis' })
    }
  },

  // Add query action
  addQuery: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    try {
      const formData = await request.formData()
      const queryText = formData.get('query')?.toString()

      if (!queryText || queryText.trim().length === 0) {
        return fail(400, { error: 'Query text is required' })
      }

      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const business = await dbService.getBusiness()
      if (!business) {
        return fail(404, { error: 'Business not found' })
      }

      // Add query logic here (you'll need to implement this in DatabaseService)
      // await dbService.addQuery(business.id, queryText.trim())

      return { success: true }

    } catch (err) {
      console.error('Error adding query:', err)
      return fail(500, { error: 'Failed to add query' })
    }
  }
}
