<script lang="ts">
  import type { Query, RankingAnalytics } from '../../types'
  import QueryCard from './QueryCard.svelte'
  
  export let queries: Query[]
  export let analytics: RankingAnalytics[]
  export let onAddQuery: () => void
</script>

{#if queries.length === 0}
  <div class="text-center py-12 bg-white rounded-lg shadow-sm">
    <h3 class="text-lg font-medium text-gray-900 mb-2">No queries yet</h3>
    <p class="text-gray-600 mb-6">
      Add your first query to start analyzing rankings!
    </p>
    <button
      onclick={onAddQuery}
      class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors cursor-pointer"
    >
      Add Your First Query
    </button>
  </div>
{:else}
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {#each queries as query}
      {@const queryAnalytics = analytics.find((a) => a.query_id === query.id)}
      <QueryCard {query} analytics={queryAnalytics} />
    {/each}
  </div>
{/if}
