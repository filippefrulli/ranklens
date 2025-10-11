import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
  // If user is authenticated, redirect to dashboard
  if (locals.user) {
    throw redirect(302, '/dashboard')
  }

  // Landing page for unauthenticated users
  return {}
}
