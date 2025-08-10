<script lang="ts">
  import { onMount } from 'svelte'
  import { DatabaseService } from '../../services/database-service'
  import { LLMService } from '../../services/llm-service'
  import { AuthService, user } from '../../services/auth-service'
  import type { Business, DashboardData } from '../../types'
  import GoogleBusinessSearch from '../business/GoogleBusinessSearch.svelte'

  let business = $state<Business | null>(null)
  let dashboardData = $state<DashboardData | null>(null)
  let detailedResults = $state<any>(null)
  let loading = $state(false)
  let loadingDetailedResults = $state(false)
  let error = $state<string | null>(null)
  let showDetailedResults = $state(false)

  // New business registration form
  let showCreateBusiness = $state(false)
  let showGoogleSearch = $state(false)
  let newBusiness = $state({
    name: '',
    google_place_id: '',
    city: '',
    google_primary_type: '',
    google_primary_type_display: '',
    google_types: []
  })

  // New query form
  let showAddQuery = $state(false)
  let newQuery = $state('')
  let runningAnalysis = $state(false)

  onMount(async () => {
    if ($user) {
      await loadBusiness()
    }
  })

  async function loadBusiness() {
    if (!$user) return
    
    try {
      loading = true
      error = null
      business = await DatabaseService.getBusiness($user.id)
      
      // If business exists, load dashboard data (including queries)
      if (business) {
        await loadDashboardData()
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load business'
    } finally {
      loading = false
    }
  }

  function handleBusinessSelected(selectedBusiness: any) {
    newBusiness = {
      name: selectedBusiness.name,
      google_place_id: selectedBusiness.google_place_id,
      city: selectedBusiness.city,
      google_primary_type: selectedBusiness.google_primary_type || '',
      google_primary_type_display: selectedBusiness.google_primary_type_display || '',
      google_types: selectedBusiness.google_types || []
    }
    showGoogleSearch = false
    showCreateBusiness = true
  }

  async function createBusiness() {
    if (!$user) return

    try {
      loading = true
      error = null
      
      const createdBusiness = await DatabaseService.createBusiness({
        ...newBusiness,
        user_id: $user.id
      })
      
      business = createdBusiness
      showCreateBusiness = false
      newBusiness = { 
        name: '', 
        google_place_id: '', 
        city: '', 
        google_primary_type: '', 
        google_primary_type_display: '', 
        google_types: [] 
      }
      
      // Load dashboard data for the new business
      await loadDashboardData()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create business'
    } finally {
      loading = false
    }
  }

  async function loadDashboardData() {
    if (!$user) return
    
    try {
      loading = true
      error = null
      dashboardData = await DatabaseService.getDashboardData($user.id)
      
      // Set the business from dashboard data
      if (dashboardData?.business) {
        business = dashboardData.business
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load business data'
    } finally {
      loading = false
    }
  }

  async function loadDetailedResults() {
    if (!business) return
    
    try {
      loading = true
      error = null
      detailedResults = await DatabaseService.getDetailedRankingResults(business.id)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load detailed results'
    } finally {
      loading = false
    }
  }

  async function addQuery() {
    if (!$user || !newQuery.trim()) return

    try {
      loading = true
      error = null
      
      // Get business ID from dashboard data or load business
      let businessId = dashboardData?.business?.id
      if (!businessId) {
        const business = await DatabaseService.getBusiness($user.id)
        if (!business) {
          error = 'Please register your business first'
          return
        }
        businessId = business.id
      }
      
      const existingQueries = dashboardData?.queries || []
      const query = await DatabaseService.createQuery({
        business_id: businessId,
        text: newQuery.trim(),
        order_index: existingQueries.length
      })
      
      // Refresh dashboard data
      await loadDashboardData()
      
      showAddQuery = false
      newQuery = ''
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add query'
    } finally {
      loading = false
    }
  }

  async function runAnalysis() {
    console.log('🚀 Starting analysis...')
    console.log('Dashboard data:', dashboardData)
    
    if (!dashboardData?.business) {
      console.error('❌ No business found in dashboard data')
      return
    }
    
    if (!dashboardData?.queries.length) {
      console.error('❌ No queries found in dashboard data')
      return
    }

    try {
      runningAnalysis = true
      error = null

      const providers = await DatabaseService.getLLMProviders()
      
      const activeProviders = providers.filter(p => p.is_active)
      
      if (activeProviders.length === 0) {
        throw new Error('No active LLM providers found')
      }
      
      // Create an analysis run for this session
      const analysisRun = await DatabaseService.createAnalysisRun(
        dashboardData.business.id, 
        dashboardData.queries.length
      )
      
      for (let i = 0; i < dashboardData.queries.length; i++) {
        const query = dashboardData.queries[i]
        
        const results = await LLMService.runRankingAnalysis(
          activeProviders,
          query.text,
          dashboardData.business.name,
          5
        )

        const rankingAttempts: any[] = []
        
        for (const [providerName, responses] of results.entries()) {
          const provider = activeProviders.find(p => p.name === providerName)
          if (!provider) {
            console.warn(`⚠️ Provider ${providerName} not found in active providers`)
            continue
          }

          responses.forEach((response, index) => {
            rankingAttempts.push({
              analysis_run_id: analysisRun.id,
              query_id: query.id,
              llm_provider_id: provider.id,
              attempt_number: index + 1,
              parsed_ranking: response.rankedBusinesses,
              target_business_rank: response.foundBusinessRank,
              success: response.success,
              error_message: response.error || null
            })
          })
        }

        if (rankingAttempts.length > 0) {
          await DatabaseService.saveRankingAttempts(rankingAttempts)
        } else {
          console.warn('⚠️ No ranking attempts to save')
        }
      }

      // Update analysis run status to completed
      await DatabaseService.updateAnalysisRun(analysisRun.id, {
        status: 'completed',
        completed_queries: dashboardData.queries.length,
        completed_llm_calls: dashboardData.queries.length * activeProviders.length * 5,
        completed_at: new Date().toISOString()
      })

      // Refresh dashboard data
      await loadDashboardData()
    } catch (err) {
      console.error('❌ Analysis failed:', err)
      error = err instanceof Error ? err.message : 'Failed to run analysis'
    } finally {
      runningAnalysis = false
    }
  }

  async function signOut() {
    await AuthService.signOut()
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <h1 class="text-2xl font-bold text-gray-900">RankLens</h1>
          {#if business}
            <span class="ml-4 text-gray-500">→</span>
            <span class="ml-2 text-lg text-gray-700">{business.name}</span>
          {/if}
        </div>
        
        {#if $user}
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-600">{$user.email}</span>
            <button 
              onclick={signOut}
              class="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if !$user}
      <!-- Auth placeholder -->
      <div class="text-center py-12">
        <h2 class="text-xl text-gray-600">Please sign in to continue</h2>
        <p class="text-sm text-gray-500 mt-2">Configure your Supabase authentication to get started</p>
      </div>
    
    {:else if !business}
      <!-- Business registration -->
      <div class="text-center py-12">
        <h2 class="text-2xl font-bold text-gray-900 mb-8">Register Your Business</h2>
        
        <div class="mb-8">
          <p class="text-gray-600 mb-4">To get started, search for your business using Google Maps.</p>
          <p class="text-sm text-gray-500">This ensures accurate data and prevents fake business registrations.</p>
        </div>

        <button 
          onclick={() => showGoogleSearch = true}
          class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors"
        >
          Search for Business
        </button>
      </div>

    {:else}
      <!-- Dashboard -->
      <div class="space-y-8">
        <!-- Quick Stats -->
        {#if dashboardData}
          <div class="grid md:grid-cols-4 gap-6">
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-sm font-medium text-gray-500">Total Queries</h3>
              <p class="text-3xl font-bold text-gray-900">{dashboardData.overall_stats.total_queries}</p>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-sm font-medium text-gray-500">LLM Calls</h3>
              <p class="text-3xl font-bold text-gray-900">{dashboardData.overall_stats.total_llm_calls}</p>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-sm font-medium text-gray-500">Average Rank</h3>
              <p class="text-3xl font-bold text-gray-900">
                {dashboardData.overall_stats.overall_average_rank 
                  ? dashboardData.overall_stats.overall_average_rank.toFixed(1) 
                  : 'N/A'}
              </p>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-sm font-medium text-gray-500">Total Mentions</h3>
              <p class="text-3xl font-bold text-gray-900">{dashboardData.overall_stats.total_mentions}</p>
            </div>
          </div>
        {/if}

        <!-- Queries Section -->
        <div class="bg-white rounded-lg shadow-md">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold text-gray-900">Queries</h2>
              <div class="space-x-2">
                <button 
                  onclick={() => showAddQuery = true}
                  class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Add Query
                </button>
                
                {#if dashboardData?.queries.length}
                  <button 
                    onclick={() => {
                      console.log('🔘 Run Analysis button clicked!')
                      runAnalysis()
                    }}
                    disabled={runningAnalysis}
                    class="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    {runningAnalysis ? 'Running Analysis...' : 'Run Analysis'}
                  </button>
                  
                  <button 
                    onclick={async () => {
                      if (showDetailedResults) {
                        showDetailedResults = false
                      } else {
                        await loadDetailedResults()
                        showDetailedResults = true
                      }
                    }}
                    class="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    {showDetailedResults ? 'Hide Details' : 'View Detailed Results'}
                  </button>
                {/if}
              </div>
            </div>
          </div>
          
          <div class="p-6">
            {#if dashboardData?.queries.length === 0}
              <p class="text-gray-600">No queries yet. Add your first query to start analyzing rankings!</p>
            {:else if dashboardData}
              <div class="space-y-6">
                <!-- Show all queries -->
                <div class="space-y-4">
                  <h4 class="font-medium text-gray-900">Your Queries</h4>
                  {#each dashboardData.queries as query}
                    <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div class="flex justify-between items-start">
                        <div class="flex-1">
                          <h3 class="font-medium text-gray-900 mb-2">{query.text}</h3>
                          <p class="text-sm text-gray-500">
                            Added {new Date(query.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <a 
                          href="/query/{query.id}"
                          class="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                        >
                          View Details
                          <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                          </svg>
                        </a>
                      </div>
                    </div>
                  {/each}
                </div>

                <!-- Show analytics if available -->
                {#if dashboardData.analytics && dashboardData.analytics.length > 0}
                  <div class="space-y-4">
                    <h4 class="font-medium text-gray-900">Analysis Results</h4>
                    {#each dashboardData.analytics as analytic}
                      <div class="border border-gray-200 rounded-lg p-4">
                        <h3 class="font-medium text-gray-900 mb-2">{analytic.query_text}</h3>
                        
                        <div class="grid md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span class="text-gray-500">Average Rank:</span>
                            <span class="font-medium">
                              {analytic.average_rank ? analytic.average_rank.toFixed(1) : 'Not found'}
                            </span>
                          </div>
                          
                          <div>
                            <span class="text-gray-500">Total Mentions:</span>
                            <span class="font-medium">{analytic.total_mentions}</span>
                          </div>
                          
                          <div>
                            <span class="text-gray-500">LLM Sources:</span>
                            <span class="font-medium">{analytic.llm_breakdown.length}</span>
                          </div>
                        </div>

                        {#if analytic.competitors_ranked_higher.length > 0}
                          <div class="mt-3">
                            <h4 class="text-sm font-medium text-gray-700 mb-2">Top Competitors:</h4>
                            <div class="flex flex-wrap gap-2">
                              {#each analytic.competitors_ranked_higher.slice(0, 3) as competitor}
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  {competitor.business_name} (#{competitor.average_rank.toFixed(1)})
                                </span>
                              {/each}
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Back to projects -->
        <div class="text-center">
          <button 
            onclick={() => { business = null; dashboardData = null }}
            class="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Business Registration
          </button>
        </div>
      </div>
    {/if}

    <!-- Detailed Results Table -->
    {#if showDetailedResults}
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">Detailed Ranking Results</h3>
        
        {#if loadingDetailedResults}
          <div class="text-center py-8">
            <div class="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-600 rounded-full" role="status"></div>
            <p class="mt-2 text-gray-600">Loading ranking results...</p>
          </div>
        {:else if detailedResults && detailedResults.length > 0}
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Query</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Rank</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Times Found</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Attempts</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Run</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each detailedResults as result}
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.query_text}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="text-sm font-medium {result.avg_rank <= 3 ? 'text-green-600' : result.avg_rank <= 7 ? 'text-yellow-600' : 'text-red-600'}">
                        {result.avg_rank !== null ? Math.round(result.avg_rank * 10) / 10 : 'N/A'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.times_found}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.total_attempts}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.last_run ? new Date(result.last_run).toLocaleDateString() : 'Never'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      <a 
                        href="/query/{result.query_id}"
                        class="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Details
                      </a>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="text-center py-8">
            <p class="text-gray-600">No ranking results available yet. Run an analysis to see detailed results.</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Google Business Search Modal -->
  {#if showGoogleSearch}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Find Your Business</h3>
        
        <GoogleBusinessSearch
          onBusinessSelected={handleBusinessSelected}
          onCancel={() => showGoogleSearch = false}
        />
      </div>
    </div>
  {/if}

  <!-- Create Business Modal -->
  {#if showCreateBusiness}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Confirm Business Details</h3>
        
        <form onsubmit={e => { e.preventDefault(); createBusiness(); }} class="space-y-4">
          <div>
            <label for="business-name" class="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input 
              id="business-name"
              bind:value={newBusiness.name}
              type="text" 
              required
              readonly
              class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label for="google-place-id" class="block text-sm font-medium text-gray-700 mb-1">Google Place ID</label>
            <input 
              id="google-place-id"
              bind:value={newBusiness.google_place_id}
              type="text" 
              required
              readonly
              class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label for="business-city" class="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input 
              id="business-city"
              bind:value={newBusiness.city}
              type="text"
              readonly
              class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {#if newBusiness.google_primary_type_display}
            <div>
              <span class="block text-sm font-medium text-gray-700 mb-1">Business Type</span>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {newBusiness.google_primary_type_display}
              </span>
            </div>
          {/if}
          
          <div class="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              onclick={() => { showCreateBusiness = false; showGoogleSearch = true }}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Back to Search
            </button>
            <button 
              type="submit"
              disabled={loading}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors"
            >
              {loading ? 'Registering...' : 'Register Business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Add Query Modal -->
  {#if showAddQuery}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Add Query</h3>
        
        <form onsubmit={e => { e.preventDefault(); addQuery(); }} class="space-y-4">
          <div>
            <label for="query-text" class="block text-sm font-medium text-gray-700 mb-1">Query Text</label>
            <textarea 
              id="query-text"
              bind:value={newQuery}
              required
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Best pizza place in New York"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">This query will be sent to all LLM providers to get ranking lists.</p>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              onclick={() => showAddQuery = false}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors"
            >
              {loading ? 'Adding...' : 'Add Query'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Error Toast -->
  {#if error}
    <div class="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50">
      <div class="flex items-center justify-between">
        <span>{error}</span>
        <button onclick={() => error = null} class="ml-4 text-red-500 hover:text-red-700">✕</button>
      </div>
    </div>
  {/if}

  <!-- Loading Overlay -->
  {#if loading}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 shadow-xl">
        <div class="flex items-center space-x-3">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span class="text-gray-700">Loading...</span>
        </div>
      </div>
    </div>
  {/if}
</div>
