<script lang="ts">
  import type { Query, RankingAnalytics } from '../../types'
  
  export let query: Query
  export let analytics: RankingAnalytics | undefined
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

  <div class="flex justify-between items-center mb-4">
    <!-- Average Rank -->
    <div class="text-center">
      <div class="text-2xl font-bold text-gray-900">
        {analytics?.average_rank
          ? analytics.average_rank.toFixed(1)
          : "N/A"}
      </div>
      <div class="text-sm text-gray-500">Average Rank</div>
    </div>

    <!-- Bigger Chart -->
    <div class="flex-1 max-w-48 ml-6">
      <div class="text-sm text-gray-500 mb-2">Trend</div>
      <div class="h-20 bg-gray-100 rounded flex items-end justify-center space-x-1">
        <!-- Simplified chart bars -->
        {#if analytics?.llm_breakdown}
          {#each analytics.llm_breakdown.slice(0, 8) as breakdown}
            <div
              class="bg-blue-400 w-3 rounded-t"
              style="height: {breakdown.average_rank
                ? Math.max(12, 80 - breakdown.average_rank * 3)
                : 12}px"
            ></div>
          {/each}
        {:else}
          <div class="text-xs text-gray-400">No data</div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Stats Row -->
  <div class="flex justify-between text-sm text-gray-600">
    <span>Mentions: {analytics?.total_mentions || 0}</span>
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
