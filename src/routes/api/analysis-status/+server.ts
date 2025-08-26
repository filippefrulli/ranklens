import type { RequestHandler } from '@sveltejs/kit'
import { createClient } from '@supabase/supabase-js'
import { env } from '$env/dynamic/private'

export const GET: RequestHandler = async ({ url, request }) => {
  try {
    const businessId = url.searchParams.get('businessId')
    
    if (!businessId) {
      return new Response(JSON.stringify({ error: 'businessId is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get the authorization header from the client
    const authorization = request.headers.get('authorization')
    if (!authorization) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create supabase client with the user's session
    const supabaseUrl = env.VITE_SUPABASE_URL
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization
        }
      }
    })

    // Now the query will work with RLS because we have the user's session
    const { data: runningAnalysis, error } = await supabase
      .from('analysis_runs')
      .select('*')
      .eq('business_id', businessId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('❌ Error fetching running analysis:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch analysis status' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
        
    return new Response(JSON.stringify({ runningAnalysis }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Error fetching analysis status:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch analysis status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
