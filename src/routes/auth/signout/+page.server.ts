import type { Actions } from './$types'
import { redirect } from '@sveltejs/kit'

export const actions: Actions = {
  default: async ({ locals }) => {
    try {
      if (locals.supabase) {
        await locals.supabase.auth.signOut()
      }
    } catch (error) {
      console.error('Error signing out:', error)
    }
    
    // Always redirect to home page after signout, regardless of success/failure
    throw redirect(303, '/')
  }
}