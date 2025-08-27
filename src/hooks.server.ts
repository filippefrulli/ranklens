import type { Handle } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { env } from '$env/dynamic/private'

export const handle: Handle = async ({ event, resolve }) => {
  // Create Supabase client
  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration missing')
    return await resolve(event)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  // Get access token from Authorization header
  const authHeader = event.request.headers.get('authorization')
  let accessToken: string | null = null
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7) // Remove 'Bearer ' prefix
  }
  
  // Also try to get access token from cookies
  if (!accessToken) {
    accessToken = event.cookies.get('sb-access-token') || null
  }
  
  if (accessToken) {
    // Verify token and get user
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    
    if (!error && user) {
      // Create authenticated Supabase client for server operations
      const authenticatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })
      
      event.locals.user = user
      event.locals.supabase = authenticatedSupabase
      event.locals.accessToken = accessToken
    }
  }
  
  return await resolve(event)
}
