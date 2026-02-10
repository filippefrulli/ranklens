import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ url, locals }) => {
  const { supabase } = locals
  const code = url.searchParams.get('code')

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Auth] Callback: Exchange failed', { error: error.message })
      redirect(303, '/auth/login')
    }
  }

  redirect(303, '/dashboard')
}