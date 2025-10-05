import type { Actions } from './$types'
import { redirect } from '@sveltejs/kit'

export const actions: Actions = {
  default: async ({ locals }) => {
    try {
      if (locals.supabase) {
        await locals.supabase.auth.signOut()
      }
    } catch (error) {
      // Silent fail - always redirect even if signout fails
    }
    
    // Always redirect to home page after signout, regardless of success/failure
    throw redirect(303, '/')
  }
}