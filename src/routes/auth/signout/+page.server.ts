import type { Actions } from './$types'
import { redirect } from '@sveltejs/kit'

export const actions: Actions = {
  default: async ({ locals }) => {
    try {
      console.log('[Auth] Signout: Signing out user')
      if (locals.supabase) {
        await locals.supabase.auth.signOut()
      }
      console.log('[Auth] Signout: Success')
    } catch (error: any) {
      console.error('[Auth] Signout: Error', { error: error?.message || 'Unknown error' })
      // Silent fail - always redirect even if signout fails
    }
    
    // Always redirect to home page after signout, regardless of success/failure
    throw redirect(303, '/')
  }
}