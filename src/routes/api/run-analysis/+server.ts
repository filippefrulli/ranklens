import type { RequestHandler } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { createClient } from '@supabase/supabase-js'
import { LLMService } from '$lib/services/llm-service'
import { DatabaseService } from '$lib/services/database-service'

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { businessId } = await request.json()
    
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

    console.log('🚀 Starting server-side analysis for business:', businessId)

    // Get business data
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (businessError || !business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get queries for this business
    const { data: queries, error: queriesError } = await supabase
      .from('queries')
      .select('*')
      .eq('business_id', businessId)

    if (queriesError || !queries || queries.length === 0) {
      return new Response(JSON.stringify({ error: 'No queries found for this business' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get active LLM providers
    const { data: providers, error: providersError } = await supabase
      .from('llm_providers')
      .select('*')
      .eq('is_active', true)

    if (providersError || !providers || providers.length === 0) {
      return new Response(JSON.stringify({ error: 'No active LLM providers found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`📊 Found ${queries.length} queries and ${providers.length} active providers`)

    // Create analysis run
    const { data: analysisRun, error: analysisRunError } = await supabase
      .from('analysis_runs')
      .insert([{
        business_id: businessId,
        run_date: new Date().toISOString().split('T')[0],
        status: 'running',
        total_queries: queries.length,
        completed_queries: 0,
        total_llm_calls: queries.length * providers.length * 5,
        completed_llm_calls: 0,
        started_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (analysisRunError || !analysisRun) {
      console.error('Failed to create analysis run:', analysisRunError)
      return new Response(JSON.stringify({ error: 'Failed to create analysis run' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('📊 Created analysis run:', analysisRun.id)

    // Start the analysis in the background
    runAnalysisInBackground(supabase, analysisRun, business, queries, providers)

    return new Response(JSON.stringify({ 
      success: true, 
      analysisRunId: analysisRun.id,
      message: 'Analysis started successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('❌ Error starting analysis:', err)
    return new Response(JSON.stringify({ 
      error: err instanceof Error ? err.message : 'Failed to start analysis' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Run the analysis in the background (non-blocking)
async function runAnalysisInBackground(
  supabase: any,
  analysisRun: any,
  business: any,
  queries: any[],
  providers: any[]
) {
  try {
    console.log('🔄 Starting background analysis...')
    let completedCalls = 0
    const totalCalls = queries.length * providers.length * 5

    for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
      const query = queries[queryIndex]
      console.log(`📝 Processing query ${queryIndex + 1}/${queries.length}: ${query.text}`)

      const rankingAttempts: any[] = []

      for (const provider of providers) {
        console.log(`🤖 Processing provider: ${provider.name}`)

        for (let attemptNum = 1; attemptNum <= 5; attemptNum++) {
          try {
            console.log(`🤖 ${provider.name} - Attempt ${attemptNum}/5`)
            
            const result = await LLMService.makeRequest(provider, query.text, business.name, 25)
            completedCalls++

            // Update progress in database every 5 calls or at the end
            if (completedCalls % 5 === 0 || completedCalls === totalCalls) {
              await supabase
                .from('analysis_runs')
                .update({ completed_llm_calls: completedCalls })
                .eq('id', analysisRun.id)
            }

            // Save successful results
            if (result.success) {
              rankingAttempts.push({
                analysis_run_id: analysisRun.id,
                query_id: query.id,
                llm_provider_id: provider.id,
                attempt_number: attemptNum,
                parsed_ranking: result.rankedBusinesses,
                target_business_rank: result.foundBusinessRank,
                success: result.success,
                error_message: result.error || null,
              })

              if (result.foundBusinessRank) {
                console.log(`✅ Found "${business.name}" at rank ${result.foundBusinessRank}`)
              }
            } else {
              console.warn(`❌ Failed LLM request from ${provider.name}: ${result.error}`)
            }

            // Small delay between requests
            if (attemptNum < 5) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }

          } catch (err) {
            console.error(`💥 Error in ${provider.name} attempt ${attemptNum}:`, err)
            completedCalls++

            // Update progress even on error
            if (completedCalls % 5 === 0 || completedCalls === totalCalls) {
              await supabase
                .from('analysis_runs')
                .update({ completed_llm_calls: completedCalls })
                .eq('id', analysisRun.id)
            }

            // Check for auth errors and skip remaining attempts
            const errorMessage = err instanceof Error ? err.message : String(err)
            if (errorMessage.toLowerCase().includes('api key') || 
                errorMessage.toLowerCase().includes('unauthorized') || 
                errorMessage.toLowerCase().includes('authentication')) {
              console.warn(`🔑 ${provider.name} auth issues - skipping remaining attempts`)
              
              // Skip remaining attempts for this provider
              const remainingAttempts = 5 - attemptNum
              completedCalls += remainingAttempts
              
              await supabase
                .from('analysis_runs')
                .update({ completed_llm_calls: completedCalls })
                .eq('id', analysisRun.id)
              
              break
            }
          }
        }

        // Delay between providers
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Save ranking attempts for this query
      if (rankingAttempts.length > 0) {
        const { error: saveError } = await supabase
          .from('ranking_attempts')
          .insert(rankingAttempts)

        if (saveError) {
          console.error('Failed to save ranking attempts:', saveError)
        }
      }

      // Update completed queries
      await supabase
        .from('analysis_runs')
        .update({ completed_queries: queryIndex + 1 })
        .eq('id', analysisRun.id)
    }

    // Mark analysis as completed
    await supabase
      .from('analysis_runs')
      .update({
        status: 'completed',
        completed_queries: queries.length,
        completed_llm_calls: totalCalls,
        completed_at: new Date().toISOString()
      })
      .eq('id', analysisRun.id)

    console.log('✅ Background analysis completed successfully!')

  } catch (err) {
    console.error('❌ Background analysis failed:', err)
    
    // Mark analysis as failed
    await supabase
      .from('analysis_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', analysisRun.id)
  }
}
