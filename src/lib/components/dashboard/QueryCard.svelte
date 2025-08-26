<script lang="ts">
  import type { Query, RankingAnalytics, QueryRankingHistory } from '../../types'
  
  export let query: Query
  export let analytics: RankingAnalytics | undefined
  export let history: QueryRankingHistory[] = []
  export let loadingHistories: boolean = false

  // Get the most recent ranking data for display
  $: latestRanking = history.length > 0 ? history[history.length - 1] : null
  $: displayRank = latestRanking?.average_rank || analytics?.average_rank

  // Calculate chart height for each bar (lower rank = taller bar)
  function getBarHeight(avgRank: number | null): number {
    if (!avgRank) return 8
    // Invert the ranking so rank 1 = tallest bar, rank 25+ = shortest bar
    return Math.max(8, 80 - (avgRank - 1) * 3)
  }

  // Format date for display
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }
</script>

<div class="bg-white rounded-lg shadow-md border border-gray-200 p-6">
  <!-- Header with Query Text and View Details Button -->
  <div class="flex justify-between items-start mb-4">
    <h3 class="text-lg font-bold text-gray-900 line-clamp-2 flex-1 pr-4">
      {query.text}
    </h3>
    
    <!-- View Details Button in Top Right -->
    <a
      href="/query/{query.id}"
      aria-label="View details for query"
      class="bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium py-2 px-3 rounded-md transition-colors cursor-pointer inline-flex items-center flex-shrink-0"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        ></path>
      </svg>
    </a>
  </div>

  <div class="flex justify-between items-center">
    {#if displayRank || history.length > 0 || (analytics?.llm_breakdown && analytics.llm_breakdown.length > 0)}
      <!-- Average Rank -->
      <div class="text-center">
        <div class="text-2xl font-bold text-gray-900">
          {displayRank
            ? displayRank.toFixed(1)
            : "N/A"}
        </div>
        <div class="text-sm text-gray-500">Average Rank</div>
        {#if latestRanking}
          <div class="text-xs text-gray-400 mt-1">
            {formatDate(latestRanking.run_date)}
          </div>
        {/if}
      </div>

      <!-- Historical Ranking Chart -->
      <div class="flex-1 max-w-64">
        <div class="text-sm text-gray-500 mb-2">
          {history.length > 0 ? 'Ranking History' : 'LLM Breakdown'}
        </div>
        <div class="h-32 bg-gray-100 rounded flex items-center justify-center space-x-1 px-2">
          {#if loadingHistories}
            <div class="text-xs text-gray-400 flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
              Loading...
            </div>
          {:else if history.length > 0}
            <div class="flex items-end justify-center space-x-1 h-full">
              {#each history.slice(-8) as run}
                <div
                  class="bg-blue-500 w-3 rounded-t transition-all duration-300"
                  style="height: {getBarHeight(run.average_rank)}px"
                  title="Rank {run.average_rank?.toFixed(1) || 'N/A'} on {formatDate(run.run_date)}"
                ></div>
              {/each}
            </div>
          {:else if analytics?.llm_breakdown && analytics.llm_breakdown.length > 0}
            <div class="flex items-end justify-center space-x-1 h-full">
              {#each analytics.llm_breakdown.slice(0, 8) as breakdown}
                <div
                  class="bg-blue-400 w-3 rounded-t"
                  style="height: {breakdown.average_rank
                    ? Math.max(12, 80 - breakdown.average_rank * 3)
                    : 12}px"
                  title="LLM: {breakdown.provider_name}, Avg Rank: {breakdown.average_rank?.toFixed(1) || 'N/A'}"
                ></div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Simple N/A state when no data -->
      <div class="flex-1 text-center">
        <div class="text-2xl font-bold text-gray-400">N/A</div>
        <div class="text-sm text-gray-500">No data yet</div>
      </div>
    {/if}
  </div>
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
