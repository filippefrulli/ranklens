<script lang="ts">
  import type { AnalysisRun, RankingAttempt, Query } from '../../types'
  import { DatabaseService } from '../../services/database-service'
  import { onMount } from 'svelte'

  const { businessId }: { businessId: string } = $props()

  let weeklyHistory: AnalysisRun[] = $state([])
  let selectedRun: AnalysisRun | null = $state(null)
  let rankingAttempts: RankingAttempt[] = $state([])
  let businessQueries: Query[] = $state([])
  let loading: boolean = $state(false)
  let error: string | null = $state(null)

  onMount(async () => {
    await loadWeeklyHistory()
    await loadBusinessQueries()
  })

  async function loadWeeklyHistory() {
    loading = true
    error = null
    try {
      weeklyHistory = await DatabaseService.getWeeklyAnalysisHistory(businessId)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load weekly history'
    } finally {
      loading = false
    }
  }

  async function loadBusinessQueries() {
    try {
      businessQueries = await DatabaseService.getQueriesForBusiness(businessId)
    } catch (err) {
      console.error('Failed to load business queries:', err)
    }
  }

  async function selectRun(run: AnalysisRun) {
    selectedRun = run
    loading = true
    error = null
    try {
      rankingAttempts = await DatabaseService.getRankingAttemptsForRun(run.id)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load ranking attempts'
    } finally {
      loading = false
    }
  }

  function getWeekRange(weekStartDate: string) {
    const start = new Date(weekStartDate)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
  }

  function getAverageRank(attempts: RankingAttempt[], queryId: string) {
    const queryAttempts = attempts.filter(a => a.query_id === queryId && a.target_business_rank !== null)
    if (queryAttempts.length === 0) return 'N/A'
    const avgRank = queryAttempts.reduce((sum, a) => sum + (a.target_business_rank || 0), 0) / queryAttempts.length
    return avgRank.toFixed(1)
  }
</script>

<div class="bg-white rounded-lg shadow-md p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Weekly Analysis History</h3>

  {#if loading && weeklyHistory.length === 0}
    <div class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  {:else if error}
    <div class="text-red-600 text-sm">{error}</div>
  {:else if weeklyHistory.length === 0}
    <div class="text-gray-500 text-center py-8">
      No analysis runs found. Run your first weekly analysis to see history here.
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Weekly Runs List -->
      <div>
        <h4 class="font-medium text-gray-900 mb-3">Analysis Runs</h4>
        <div class="space-y-2">
          {#each weeklyHistory as run}
            <button
              onclick={() => selectRun(run)}
              class="w-full text-left p-3 rounded-md border transition-colors
                {selectedRun?.id === run.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}"
            >
              <div class="font-medium text-sm text-gray-900">
                Week of {getWeekRange(run.week_start_date!)}
              </div>
              <div class="text-xs text-gray-500 mt-1">
                Completed: {new Date(run.completed_at!).toLocaleDateString()}
              </div>
              <div class="text-xs text-gray-600 mt-1">
                Status: <span class="capitalize">{run.status}</span>
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Selected Run Details -->
      <div>
        {#if selectedRun}
          <h4 class="font-medium text-gray-900 mb-3">
            Analysis Results - Week of {getWeekRange(selectedRun.week_start_date!)}
          </h4>
          
          {#if loading}
            <div class="flex justify-center items-center py-8">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          {:else if rankingAttempts.length === 0}
            <div class="text-gray-500 text-sm">No ranking attempts found for this run.</div>
          {:else}
            <div class="space-y-4">
              <!-- Group by Query -->
              {#each businessQueries as query}
                <div class="border border-gray-200 rounded-md p-3">
                  <h5 class="font-medium text-sm text-gray-900 mb-2">{query.text}</h5>
                  
                  <div class="text-sm text-gray-600 mb-2">
                    Average Rank: <span class="font-medium">{getAverageRank(rankingAttempts, query.id)}</span>
                  </div>

                  <!-- Individual Attempts -->
                  <div class="space-y-1">
                    {#each rankingAttempts.filter(a => a.query_id === query.id) as attempt}
                      <div class="flex justify-between items-center text-xs">
                        <span class="text-gray-600">Attempt {attempt.attempt_number}</span>
                        <span class="font-medium {attempt.target_business_rank ? 'text-gray-900' : 'text-red-600'}">
                          {attempt.target_business_rank ? `Rank ${attempt.target_business_rank}` : 'Not found'}
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="text-gray-500 text-sm text-center py-8">
            Select an analysis run to view detailed results
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
