<script lang="ts">
  import { onMount } from 'svelte'
  import type { Query, RankingAnalytics, QueryRankingHistory } from '../../types'
  import { DatabaseService } from '../../services/database-service'
  import QueryCard from './QueryCard.svelte'
  
  interface Props {
    queries: Query[]
    analytics: RankingAnalytics[]
    onAddQuery: () => void
  }
  
  let { queries, analytics, onAddQuery }: Props = $props()

  // Store historical data for each query
  let queryHistories = $state<Map<string, QueryRankingHistory[]>>(new Map())
  let loadingHistories = $state(false)

  onMount(async () => {
    await loadQueryHistories()
  })

  async function loadQueryHistories() {
    loadingHistories = true
    try {
      const histories = new Map()
      for (const query of queries) {
        console.log(`Loading history for query: ${query.id}`)
        const history = await DatabaseService.getQueryRankingHistory(query.id, 10)
        console.log(`History for query ${query.id}:`, history)
        histories.set(query.id, history)
      }
      queryHistories = histories
    } catch (error) {
      console.error('Failed to load query histories:', error)
    } finally {
      loadingHistories = false
    }
  }

  // Reactive update when queries change
  $effect(() => {
    if (queries.length > 0) {
      loadQueryHistories()
    }
  })
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
      {@const queryHistory = queryHistories.get(query.id) || []}
      <QueryCard 
        {query} 
        analytics={queryAnalytics} 
        history={queryHistory}
        {loadingHistories}
      />
    {/each}
  </div>
{/if}
