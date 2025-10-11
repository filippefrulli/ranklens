import { LLMService } from './llm-service'
import { DatabaseService } from './database-service'
import type { Business, Query, LLMProvider, AnalysisRun } from '../types'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

export class AnalysisService {
  private dbService: DatabaseService
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
    this.dbService = new DatabaseService(supabase, userId)
  }

  // Run complete analysis for a business (with RLS)
  async runAnalysis(businessId: string): Promise<{ success: boolean; analysisRunId?: string; error?: string }> {
    console.log(`🚀 Starting analysis for business: ${businessId}`)
    
    try {
      // Validate ownership through RLS
      const isOwner = await this.dbService.validateBusinessOwnership(businessId)
      if (!isOwner) {
        console.error(`❌ Analysis failed: Unauthorized access to business ${businessId}`)
        return { success: false, error: 'Unauthorized: Business not found or access denied' }
      }
      
      // Get business data (RLS will ensure user can only access their business)
      const business = await this.dbService.getBusiness()
      if (!business) {
        console.error(`❌ Analysis failed: Business not found for ID ${businessId}`)
        return { success: false, error: 'Business not found' }
      }

      // Get queries
      const queries = await this.dbService.getQueriesForBusiness(businessId)
      if (queries.length === 0) {
        console.error(`❌ Analysis failed: No queries found for business ${business.name}`)
        return { success: false, error: 'No queries found for this business' }
      }

      // Get active providers
      const providers = await this.dbService.getActiveLLMProviders()
      if (providers.length === 0) {
        console.error(`❌ Analysis failed: No active LLM providers found`)
        return { success: false, error: 'No active LLM providers found' }
      }

  // Create analysis run
      const analysisRun = await this.dbService.createAnalysisRun(businessId, queries.length)

      console.log(`✅ Analysis setup complete for "${business.name}": ${queries.length} queries × ${providers.length} providers × 5 attempts = ${queries.length * providers.length * 5} total LLM calls`)
      
      // Create a cookie-less background Supabase client to avoid cookies.set after response
      let backgroundDb = this.dbService
      try {
        const { data: { session } } = await this.supabase.auth.getSession()
        const accessToken = session?.access_token
        const backgroundSupabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          },
          global: {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
          }
        })
        backgroundDb = new DatabaseService(backgroundSupabase as any, this.userId)
      } catch (e) {
        console.warn('Failed to initialize background Supabase client; falling back to request-bound client:', e)
      }

      // Start the analysis in the background with the background client
      this.runAnalysisInBackground(analysisRun, business, queries, providers, backgroundDb)

      return { success: true, analysisRunId: analysisRun.id }

    } catch (err) {
      console.error('❌ Error starting analysis:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to start analysis' 
      }
    }
  }

  // Background analysis execution
  private async runAnalysisInBackground(
    analysisRun: AnalysisRun,
    business: Business,
    queries: Query[],
    providers: LLMProvider[],
    db: DatabaseService
  ) {
    const startTime = Date.now()
    console.log(`🔄 Background analysis started for "${business.name}"`)
    
    try {
      let completedCalls = 0
      const totalCalls = queries.length * providers.length * 5
      let successfulCalls = 0
      let failedCalls = 0

      // Update total calls in analysis run
      await db.updateAnalysisRun(analysisRun.id, {
        total_llm_calls: totalCalls
      })

      for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
        const query = queries[queryIndex]

        const rankingAttempts: any[] = []

        for (const provider of providers) {

          for (let attemptNum = 1; attemptNum <= 5; attemptNum++) {
            try {              
              const result = await LLMService.makeRequest(provider, query.text, business.name, 25)
              completedCalls++

              if (result.success) {
                successfulCalls++
              } else {
                failedCalls++
              }

              // Save ALL results, whether successful or not
              rankingAttempts.push({
                analysis_run_id: analysisRun.id,
                query_id: query.id,
                llm_provider_id: provider.id,
                attempt_number: attemptNum,
                parsed_ranking: result.rankedBusinesses || [],
                target_business_rank: result.foundBusinessRank,
                success: result.success,
                error_message: result.error || null,
              })

              // Update progress in database every 5 calls or at the end
              if (completedCalls % 5 === 0 || completedCalls === totalCalls) {
                try {
                  await db.updateAnalysisRun(analysisRun.id, {
                    completed_llm_calls: completedCalls
                  })
                } catch (updateError) {
                  console.warn(`⚠️ Failed to update progress (${completedCalls}/${totalCalls}):`, updateError instanceof Error ? updateError.message : updateError)
                  // Continue analysis even if progress update fails
                }
              }

              // Small delay between requests
              if (attemptNum < 5) {
                await new Promise(resolve => setTimeout(resolve, 1000))
              }

            } catch (err) {
              console.error(`💥 Error in ${provider.name} attempt ${attemptNum}:`, err)
              completedCalls++

              // Save failed attempt
              const errorMessage = err instanceof Error ? err.message : String(err)
              rankingAttempts.push({
                analysis_run_id: analysisRun.id,
                query_id: query.id,
                llm_provider_id: provider.id,
                attempt_number: attemptNum,
                parsed_ranking: [],
                target_business_rank: null,
                success: false,
                error_message: errorMessage,
              })

              // Update progress even on error
              if (completedCalls % 5 === 0 || completedCalls === totalCalls) {
                try {
                  await db.updateAnalysisRun(analysisRun.id, {
                    completed_llm_calls: completedCalls
                  })
                } catch (updateError) {
                  console.warn(`⚠️ Failed to update progress after error (${completedCalls}/${totalCalls}):`, updateError instanceof Error ? updateError.message : updateError)
                  // Continue analysis even if progress update fails
                }
              }

              // Check for auth errors and skip remaining attempts
              if (errorMessage.toLowerCase().includes('api key') || 
                  errorMessage.toLowerCase().includes('unauthorized') || 
                  errorMessage.toLowerCase().includes('authentication')) {
                console.warn(`🔑 ${provider.name} auth issues - skipping remaining attempts`)
                
                // Skip remaining attempts for this provider and save them as failed
                for (let skipAttempt = attemptNum + 1; skipAttempt <= 5; skipAttempt++) {
                  completedCalls++
                  rankingAttempts.push({
                    analysis_run_id: analysisRun.id,
                    query_id: query.id,
                    llm_provider_id: provider.id,
                    attempt_number: skipAttempt,
                    parsed_ranking: [],
                    target_business_rank: null,
                    success: false,
                    error_message: `Skipped due to authentication error: ${errorMessage}`,
                  })
                }
                
                try {
                  await db.updateAnalysisRun(analysisRun.id, {
                    completed_llm_calls: completedCalls
                  })
                } catch (updateError) {
                  console.warn(`⚠️ Failed to update progress after auth error skip:`, updateError instanceof Error ? updateError.message : updateError)
                  // Continue analysis even if progress update fails
                }
                
                break
              }
            }
          }

          // Delay between providers
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Save ranking attempts for this query
        if (rankingAttempts.length > 0) {
          try {
            await db.saveRankingAttempts(rankingAttempts)
          } catch (saveError) {
            console.warn(`⚠️ Failed to save ranking attempts for query "${query.text}":`, saveError instanceof Error ? saveError.message : saveError)
            // Continue analysis even if saving attempts fails
          }
        } else {
          console.warn(`⚠️ No ranking attempts to save for query: ${query.text}`)
        }

        // Update completed queries
        try {
          await db.updateAnalysisRun(analysisRun.id, {
            completed_queries: queryIndex + 1
          })
        } catch (updateError) {
          console.warn(`⚠️ Failed to update completed queries count:`, updateError instanceof Error ? updateError.message : updateError)
          // Continue analysis even if query count update fails
        }
      }

      // Mark analysis as completed
      try {
        await db.updateAnalysisRun(analysisRun.id, {
          status: 'completed',
          completed_queries: queries.length,
          completed_llm_calls: totalCalls,
          completed_at: new Date().toISOString()
        })
        console.log('✅ Analysis marked as completed successfully')
      } catch (completionError) {
        console.warn(`⚠️ Failed to mark analysis as completed:`, completionError instanceof Error ? completionError.message : completionError)
        // Analysis data is still collected, just status update failed
      }

      try {
        const competitorResultsCount = await db.populateCompetitorResultsForAnalysisRun(analysisRun.id)
        
        const duration = Math.round((Date.now() - startTime) / 1000)
        console.log(`🎉 ANALYSIS COMPLETED for "${business.name}" in ${duration}s`)
        console.log(`📈 Results: ${successfulCalls}/${totalCalls} successful calls, ${failedCalls} failed`)
        console.log(`🏆 Competitors: ${competitorResultsCount} competitor results generated`)
        console.log(`📋 Summary: ${queries.length} queries analyzed across ${providers.length} LLM providers`)
        
      } catch (competitorError) {
        console.error('❌ Failed to populate competitor results:', competitorError instanceof Error ? competitorError.message : competitorError)
        
        // Still log completion even if competitor results failed
        const duration = Math.round((Date.now() - startTime) / 1000)
        console.log(`🎉 ANALYSIS COMPLETED for "${business.name}" in ${duration}s (competitor results failed)`)
        console.log(`📈 Results: ${successfulCalls}/${totalCalls} successful calls, ${failedCalls} failed`)
        console.log(`📋 Summary: ${queries.length} queries analyzed across ${providers.length} LLM providers`)
      }

    } catch (err) {
      const duration = Math.round((Date.now() - startTime) / 1000)
      console.error(`💥 ANALYSIS FAILED for "${business.name}" after ${duration}s:`, err instanceof Error ? err.message : err)
      
      // Mark analysis as failed
      try {
        await db.updateAnalysisRun(analysisRun.id, {
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        console.log(`📝 Analysis failure status saved to database`)
      } catch (failureUpdateError) {
        console.error(`❌ Failed to mark analysis as failed:`, failureUpdateError instanceof Error ? failureUpdateError.message : failureUpdateError)
      }
    }
  }

  // Get analysis status
  async getAnalysisStatus(businessId: string): Promise<AnalysisRun | null> {
    return await this.dbService.getRunningAnalysisForBusiness(businessId)
  }
}
