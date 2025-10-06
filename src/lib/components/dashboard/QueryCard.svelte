<script lang="ts">
  import type { Query, RankingAnalytics, QueryRankingHistory } from '../../types'
  import RankingChart from './RankingChart.svelte'
  
  export let query: Query
  export let analytics: RankingAnalytics | undefined
  export let history: QueryRankingHistory[] = []
  export let loadingHistories: boolean = false

  // Get the most recent ranking data for display
  $: latestRanking = history.length > 0 ? history[history.length - 1] : null
  $: displayRank = latestRanking?.average_rank || analytics?.average_rank

  // Format date for display
  function formatDate(dateStr: string): string {
    // Handle date string from PostgreSQL (can be date or timestamp)
    try {
      if (!dateStr) return 'N/A'
      
      // Extract date portion (YYYY-MM-DD) from timestamp or use as-is
      const datePart = dateStr.split('T')[0]
      
      // Parse the date in local timezone to avoid shifts
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [year, month, day] = datePart.split('-').map(Number)
        const date = new Date(year, month - 1, day) // month is 0-indexed
        
        if (isNaN(date.getTime())) {
          return 'N/A'
        }
        
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        })
      }
      
      return 'N/A'
    } catch (error) {
      return 'N/A'
    }
  }
</script>

<div class="bg-white rounded-lg border border-gray-200 p-6">
  <!-- Header with Query Text and View Details Button -->
  <div class="flex justify-between items-start mb-4">
    <h3 class="text-lg font-bold text-gray-900 line-clamp-2 flex-1 pr-4">
      {query.text}
    </h3>
    
    <!-- View Details Button in Top Right -->
    <a
      href="/query/{query.id}"
      aria-label="View details for query"
	class="bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 hover:text-slate-900 text-sm font-medium py-2 px-3 rounded-md transition-colors cursor-pointer inline-flex items-center flex-shrink-0"
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
      <RankingChart 
        history={history}
        llmBreakdown={analytics?.llm_breakdown}
        loading={loadingHistories}
      />
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
