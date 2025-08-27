import { ServerLLMService } from './llm-service'
import { ServerDatabaseService } from './database-service'
import type { Business, Query, LLMProvider, AnalysisRun } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'

export class ServerAnalysisService {
  private dbService: ServerDatabaseService

  constructor(supabase: SupabaseClient, userId: string) {
    this.dbService = new ServerDatabaseService(supabase, userId)
  }

  // Run complete analysis for a business (with RLS)
  async runAnalysis(businessId: string): Promise<{ success: boolean; analysisRunId?: string; error?: string }> {
    try {
      // Validate ownership through RLS
      const isOwner = await this.dbService.validateBusinessOwnership(businessId)
      if (!isOwner) {
        return { success: false, error: 'Unauthorized: Business not found or access denied' }
      }
      
      // Get business data (RLS will ensure user can only access their business)
      const business = await this.dbService.getBusiness()
      if (!business) {
        return { success: false, error: 'Business not found' }
      }

      // Get queries
      const queries = await this.dbService.getQueriesForBusiness(businessId)
      if (queries.length === 0) {
        return { success: false, error: 'No queries found for this business' }
      }

      // Get active providers
      const providers = await this.dbService.getActiveLLMProviders()
      if (providers.length === 0) {
        return { success: false, error: 'No active LLM providers found' }
      }

      // Create analysis run
      const analysisRun = await this.dbService.createAnalysisRun(businessId, queries.length)

      // Start the analysis in the background
      this.runAnalysisInBackground(analysisRun, business, queries, providers)

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
    providers: LLMProvider[]
  ) {
    try {
      let completedCalls = 0
      const totalCalls = queries.length * providers.length * 5

      // Update total calls in analysis run
      await this.dbService.updateAnalysisRun(analysisRun.id, {
        total_llm_calls: totalCalls
      })

      for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
        const query = queries[queryIndex]

        const rankingAttempts: any[] = []

        for (const provider of providers) {

          for (let attemptNum = 1; attemptNum <= 5; attemptNum++) {
            try {
              console.log(`🤖 ${provider.name} - Attempt ${attemptNum}/5`)
              
              const result = await ServerLLMService.makeRequest(provider, query.text, business.name, 25)
              completedCalls++

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

              if (result.success) {
                if (result.foundBusinessRank) {
                  console.log(`✅ Found "${business.name}" at rank ${result.foundBusinessRank}`)
                } else {
                  console.log(`📊 Business "${business.name}" not found in ranking`)
                }
              } else {
                console.warn(`❌ Failed LLM request from ${provider.name}: ${result.error}`)
              }

              // Update progress in database every 5 calls or at the end
              if (completedCalls % 5 === 0 || completedCalls === totalCalls) {
                await this.dbService.updateAnalysisRun(analysisRun.id, {
                  completed_llm_calls: completedCalls
                })
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
                await this.dbService.updateAnalysisRun(analysisRun.id, {
                  completed_llm_calls: completedCalls
                })
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
                
                await this.dbService.updateAnalysisRun(analysisRun.id, {
                  completed_llm_calls: completedCalls
                })
                
                break
              }
            }
          }

          // Delay between providers
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // Save ranking attempts for this query
        if (rankingAttempts.length > 0) {
          await this.dbService.saveRankingAttempts(rankingAttempts)
          console.log(`✅ Successfully saved ${rankingAttempts.length} ranking attempts`)
        } else {
          console.warn(`⚠️ No ranking attempts to save for query: ${query.text}`)
        }

        // Update completed queries
        await this.dbService.updateAnalysisRun(analysisRun.id, {
          completed_queries: queryIndex + 1
        })
      }

      // Mark analysis as completed
      await this.dbService.updateAnalysisRun(analysisRun.id, {
        status: 'completed',
        completed_queries: queries.length,
        completed_llm_calls: totalCalls,
        completed_at: new Date().toISOString()
      })

      try {
        const competitorResultsCount = await this.dbService.populateCompetitorResultsForAnalysisRun(analysisRun.id)
        console.log(`✅ Populated ${competitorResultsCount} competitor results`)
      } catch (competitorError) {
        console.error('❌ Failed to populate competitor results:', competitorError)
        // Don't fail the whole analysis if competitor results fail
      }

    } catch (err) {
      console.error('❌ Background analysis failed:', err)
      
      // Mark analysis as failed
      await this.dbService.updateAnalysisRun(analysisRun.id, {
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
    }
  }

  // Get analysis status
  async getAnalysisStatus(businessId: string): Promise<AnalysisRun | null> {
    return await this.dbService.getRunningAnalysisForBusiness(businessId)
  }
}
