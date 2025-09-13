<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'
  import QueryResultHeader from '../../../lib/components/query/QueryResultHeader.svelte'
  import RankingResultsByLLMTable from '../../../lib/components/query/RankingResultsByLLMTable.svelte'
  import CompetitorRankingsTable from '../../../lib/components/query/CompetitorRankingsTable.svelte'
  import LoadingSpinner from '../../../lib/components/ui/LoadingSpinner.svelte'
  import ErrorMessage from '../../../lib/components/ui/ErrorMessage.svelte'
  import LLMProviderDropdown from '../../../lib/components/ui/LLMProviderDropdown.svelte'
  import type { Query, RankingAttempt, LLMProvider } from '../../../lib/types'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()

  // Get user and query data from server-side load
  const user = $derived(data.user)
  const supabase = $derived(data.supabase)

  let query = $state<Query | null>(data.query)
  let analysisRuns = $state<{id: string, created_at: string}[]>(data.analysisRuns)
  let selectedRunId = $state<string | null>(null)
  let rankingResults = $state<RankingAttempt[]>([])
  let competitorRankings = $state<any[]>([])
  let llmProviders = $state<LLMProvider[]>(data.llmProviders)
  let selectedProvider = $state<LLMProvider | null>(null) // null means "All providers"
  let loading = $state(false)
  let loadingData = $state(false)
  let error = $state<string | null>(null)

  let queryId = $derived($page.params.id || '')

  // Filtered data based on selected provider
  let filteredRankingResults = $derived(() => {
    if (!selectedProvider) return rankingResults
    return rankingResults.filter(result => result.llm_provider_id === selectedProvider!.id)
  })

  onMount(() => {
    // Data is already loaded from server, just select the latest run if available
    if (analysisRuns.length > 0) {
      selectedRunId = analysisRuns[0].id
      loadRunData(analysisRuns[0].id)
    }
  })

  async function loadRunData(runId: string) {
    if (!queryId || !runId) return
    
    try {
      loadingData = true

      // Load ranking results for this specific run using direct supabase calls
      const { data: rankings, error: rankingsError } = await supabase
        .from('ranking_attempts')
        .select(`
          *,
          analysis_runs!inner(
            id,
            created_at
          ),
          llm_providers!inner(
            id,
            name
          )
        `)
        .eq('query_id', queryId)
        .eq('analysis_run_id', runId)
        .order('created_at', { ascending: false })

      if (rankingsError) {
        throw new Error(`Failed to fetch ranking results: ${rankingsError.message}`)
      }

      rankingResults = rankings || []

      // Load competitor rankings
      const { data: competitorData, error: competitorError } = await supabase
        .from('competitor_results')
        .select('*')
        .eq('query_id', queryId)
        .eq('analysis_run_id', runId)
        .order('average_rank', { ascending: true })

      if (competitorError) {
        throw new Error(`Failed to fetch competitor rankings: ${competitorError.message}`)
      }
      
      let competitors = competitorData || []
      
      // Filter by selected provider if one is selected
      if (selectedProvider) {
        competitors = competitors.filter(competitor => 
          competitor.llm_providers && 
          competitor.llm_providers.length === 1 && 
          competitor.llm_providers.includes(selectedProvider!.name)
        )
      } else {
        // When no provider is selected, show only records that include all providers for each business
        // Group by business name and show the record with the most providers
        const businessGroups = new Map()
        competitors.forEach(competitor => {
          const businessName = competitor.business_name
          if (!businessGroups.has(businessName) || 
              competitor.llm_providers.length > businessGroups.get(businessName).llm_providers.length) {
            businessGroups.set(businessName, competitor)
          }
        })
        competitors = Array.from(businessGroups.values())
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
    {#if error}
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
      <QueryResultHeader 
        {query} 
        {goBack} 
        {llmProviders}
        {selectedProvider}
        {onProviderChange}
      />
      
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
