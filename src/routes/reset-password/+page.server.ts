import { fail } from '@sveltejs/kit'
import type { Actions } from '@sveltejs/kit'

export const load = async ({ locals }: { locals: App.Locals }) => {
  const { session } = locals

  // Return session status to client
  return {
    hasSession: !!session
  }
}

export const actions: Actions = {
  updatePassword: async ({ request, locals }) => {
    const { supabase, session } = locals

    if (!session?.user) {
      console.log('[Action] updatePassword: No valid session')
      return fail(401, { 
        error: 'Authentication required. Please use the password reset link from your email.',
        success: false 
      })
    }

    try {
      const formData = await request.formData()
      const password = formData.get('password')?.toString()

      // Validate input
      if (!password || typeof password !== 'string') {
        console.log('[Action] updatePassword: Invalid password format')
        return fail(400, { 
          error: 'Password is required',
          success: false 
        })
      }

      if (password.length < 10) {
        console.log('[Action] updatePassword: Password too short')
        return fail(400, { 
          error: 'Password must be at least 10 characters long',
          success: false 
        })
      }

      // Update password using server-side supabase client
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        console.error('[Action] updatePassword: Failed to update', { error: error.message })
        
        // Map common Supabase errors to user-friendly messages
        let errorMessage = 'Failed to update password. Please try again.'
        const msg = error.message.toLowerCase()
        
        if (msg.includes('same') && msg.includes('password')) {
          errorMessage = 'Your new password must be different from the current password.'
        } else if (msg.includes('expired') || msg.includes('invalid') || msg.includes('session')) {
          errorMessage = 'This reset link is invalid or expired. Please request a new password reset email.'
        } else if (msg.includes('rate') && msg.includes('limit')) {
          errorMessage = 'Too many attempts. Please wait a moment and try again.'
        }
        
        return fail(400, { 
          error: errorMessage,
          success: false 
        })
      }

      console.log('[Action] updatePassword: Success')
      return { success: true }
    } catch (error: any) {
      console.error('[Action] updatePassword: Exception', { error: error?.message || 'Unknown error' })
      return fail(500, { 
        error: 'An unexpected error occurred. Please try again.',
        success: false 
      })
    }
  }
}
