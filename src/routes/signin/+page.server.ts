import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals }) => {
  // If user is already authenticated, redirect to dashboard
  if (locals.user) {
    throw redirect(303, '/')
  }

  // No need to return anything - client will use client-side supabase
  return {}
}