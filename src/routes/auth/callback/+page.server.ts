import { redirect } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'

export const load = async ({ url, locals }: RequestEvent) => {
  const { supabase } = locals
  const code = url.searchParams.get('code')

  if (code) {
    try {
      // Exchange the auth code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return {
          error: error.message
        }
      }

      // Successful authentication, redirect to dashboard
      throw redirect(303, '/')
    } catch (err) {
      if (err instanceof Response && err.status === 303) {
        // This is our redirect, re-throw it
        throw err
      }
      
      console.error('Callback processing error:', err)
      return {
        error: 'Authentication failed. Please try again.'
      }
    }
  }

  // No code parameter, redirect to login
  throw redirect(303, '/auth/login')
}