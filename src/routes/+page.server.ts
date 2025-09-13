import type { PageServerLoad, Actions } from './$types'
import { fail } from '@sveltejs/kit'
import { DatabaseService } from '$lib/services/database-service'
import { QuerySuggestionService } from '$lib/services/query-suggestion-service'

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
