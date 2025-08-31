<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { DatabaseService } from '../../../lib/services/database-service'
  import { user } from '../../../lib/services/auth-service'
  import QueryResultHeader from '../../../lib/components/query/QueryResultHeader.svelte'
  import RankingResultsByLLMTable from '../../../lib/components/query/RankingResultsByLLMTable.svelte'
  import CompetitorRankingsTable from '../../../lib/components/query/CompetitorRankingsTable.svelte'
  import LoadingSpinner from '../../../lib/components/ui/LoadingSpinner.svelte'
  import ErrorMessage from '../../../lib/components/ui/ErrorMessage.svelte'
  import LLMProviderDropdown from '../../../lib/components/ui/LLMProviderDropdown.svelte'
  import type { Query, RankingAttempt, LLMProvider } from '../../../lib/types'

  let query = $state<Query | null>(null)
  let analysisRuns = $state<{id: string, created_at: string}[]>([])
  let selectedRunId = $state<string | null>(null)
  let rankingResults = $state<RankingAttempt[]>([])
  let competitorRankings = $state<any[]>([])
  let llmProviders = $state<LLMProvider[]>([])
  let selectedProvider = $state<LLMProvider | null>(null) // null means "All providers"
  let loading = $state(false)
  let loadingData = $state(false)
  let error = $state<string | null>(null)

  let queryId = $derived($page.params.id || '')

  // Filtered data based on selected provider
  let filteredRankingResults = $derived(() => {
    if (!selectedProvider) return rankingResults
    return rankingResults.filter(result => result.llm_provider_id === selectedProvider.id)
  })

  onMount(() => {
    if ($user && queryId) {
      loadInitialData()
    }
  })

  async function loadInitialData() {
    if (!queryId || !$user) return
    
    try {
      loading = true
      error = null

      // Get query details
      const queryData = await DatabaseService.getQuery(queryId)
      if (!queryData) {
        error = 'Query not found'
        return
      }

      // Verify access
      const business = await DatabaseService.getBusiness($user.id)
      if (!business || queryData.business_id !== business.id) {
        error = 'Access denied'
        return
      }

      query = queryData

      // Get analysis runs and LLM providers
      const [runs, providers] = await Promise.all([
        DatabaseService.getQueryAnalysisRuns(queryId),
        DatabaseService.getLLMProviders()
      ])
      
      analysisRuns = runs
      llmProviders = providers
      
      // Select the latest run by default
      if (runs.length > 0) {
        selectedRunId = runs[0].id
        await loadRunData(runs[0].id)
      }

    } catch (err: any) {
      console.error('� Error loading initial data:', err)
      error = err.message || 'Failed to load data'
    } finally {
      loading = false
    }
  }

  async function loadRunData(runId: string) {
    if (!queryId || !runId) return
    
    try {
      loadingData = true

      // Load ranking results for this specific run
      const rankings = await DatabaseService.getQueryRankingResultsByRun(queryId, runId)
      rankingResults = rankings

      // Load competitor rankings based on selected provider
      let competitors
      if (selectedProvider) {
        competitors = await DatabaseService.getCompetitorRankingsByRunAndProvider(queryId, runId, selectedProvider.id)
      } else {
        competitors = await DatabaseService.getCompetitorRankingsByRun(queryId, runId)
      }
      competitorRankings = competitors

    } catch (err: any) {
      console.error('💥 Error loading run data:', err)
      error = err.message || 'Failed to load run data'
    } finally {
      loadingData = false
    }
  }

  // When provider selection changes, reload the data
  async function onProviderChange(provider: LLMProvider | null) {
    selectedProvider = provider
    if (selectedRunId) {
      await loadRunData(selectedRunId)
    }
  }

  async function selectRun(runId: string) {
    if (runId === selectedRunId) return
    
    selectedRunId = runId
    await loadRunData(runId)
  }

  function goBack() {
    goto('/')
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
</script>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {#if loading}
      <LoadingSpinner message="Loading query results..." />
    {:else if error}
      <ErrorMessage {error} onDismiss={() => error = null} />
      <div class="mt-4">
        <button 
          onclick={goBack}
          class="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
        >
          ← Back to Dashboard
        </button>
      </div>
    {:else if query}
      <QueryResultHeader {query} {goBack} />
      
      <!-- LLM Provider Filter -->
      {#if llmProviders.length > 0}
        <div class="bg-white rounded-lg shadow p-6 mb-6">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-medium text-gray-900">Filter by LLM Provider</h3>
              <p class="text-sm text-gray-500 mt-1">View results from specific LLM providers or all combined</p>
            </div>
            <div class="w-64">
              <LLMProviderDropdown 
                providers={llmProviders}
                selectedProvider={selectedProvider}
                onProviderChange={onProviderChange}
                showLabel={false}
              />
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Analysis Run Selector and LLM Results side by side -->
      {#if analysisRuns.length > 0}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Analysis Runs (Left Half) -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Analysis Runs</h3>
            <div class="space-y-2">
              {#each analysisRuns as run (run.id)}
                <label class="flex items-center p-3 rounded-lg border cursor-pointer hover:bg-gray-50 {selectedRunId === run.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}">
                  <input
                    type="radio"
                    name="analysisRun"
                    value={run.id}
                    checked={selectedRunId === run.id}
                    onchange={() => selectRun(run.id)}
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div class="ml-3 flex-1">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium text-gray-900">
                        {formatDate(run.created_at)}
                      </span>
                      {#if selectedRunId === run.id}
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Selected
                        </span>
                      {/if}
                    </div>
                    <p class="text-sm text-gray-500">
                      Run ID: {run.id.slice(0, 8)}...
                    </p>
                  </div>
                </label>
              {/each}
            </div>
          </div>
          
          <!-- LLM Results (Right Half) -->
          {#if selectedRunId && filteredRankingResults().length > 0}
            <RankingResultsByLLMTable rankingResults={filteredRankingResults()} />
          {:else if selectedRunId}
            <div class="bg-white rounded-lg shadow p-6 flex items-center justify-center">
              <p class="text-gray-500">
                {selectedProvider ? 'No LLM results for selected provider and run' : 'No LLM results for selected run'}
              </p>
            </div>
          {:else}
            <div class="bg-white rounded-lg shadow p-6 flex items-center justify-center">
              <p class="text-gray-500">Select a run to view LLM results</p>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Results Tables -->
      {#if loadingData}
        <div class="bg-white rounded-lg shadow p-6 text-center">
          <LoadingSpinner message="Loading run data..." />
        </div>
      {:else if selectedRunId && competitorRankings.length > 0}
        <!-- Competitor Rankings (full width) -->
        <CompetitorRankingsTable {competitorRankings} />
      {:else if selectedRunId}
        <div class="bg-white rounded-lg shadow p-6 text-center">
          <p class="text-gray-500">
            {selectedProvider ? 'No competitor rankings found for the selected provider and analysis run.' : 'No competitor rankings found for the selected analysis run.'}
          </p>
        </div>
      {:else if analysisRuns.length === 0}
        <div class="bg-white rounded-lg shadow p-6 text-center">
          <p class="text-gray-500">No analysis runs found for this query. Run an analysis to see results.</p>
        </div>
      {/if}
    {/if}
  </div>
</div>
