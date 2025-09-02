import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'
import { ServerDatabaseService } from '$lib/server/database-service'
import type { QuerySources } from '$lib/types'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || !locals.supabase) {
    throw error(401, 'Unauthorized')
  }

  try {
    const dbService = new ServerDatabaseService(locals.supabase, locals.user.id)
    
    // Get the user's business
    const business = await dbService.getBusiness()
    if (!business) {
      throw error(404, 'Business not found')
    }

    // Get all queries for the business
    const queries = await dbService.getQueriesForBusiness(business.id)
    
    // Get sources for all queries and the business
    const sourcesData = await Promise.all([
      // Get business sources
      dbService.getBusinessSources(business.id),
      // Get sources for each query
      ...queries.map(query => dbService.getQuerySources(query.id))
    ])

    const businessSources = sourcesData[0]
    const querySources = sourcesData.slice(1).filter(Boolean) as QuerySources[]

    return {
      business,
      queries,
      businessSources,
      querySources
    }
  } catch (err) {
    console.error('Error loading sources page:', err)
    throw error(500, 'Failed to load sources data')
  }
}
