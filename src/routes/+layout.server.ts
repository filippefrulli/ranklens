import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  // session & user are already validated by authGuard in hooks.server.ts
  return {
    session: locals.session,
    user: locals.user,
    cookies: cookies.getAll(),
  }
}