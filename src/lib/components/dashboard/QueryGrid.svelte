<script lang="ts">
  import { onMount } from 'svelte'
  import type { Query, RankingAnalytics, QueryRankingHistory } from '../../types'
  import { DatabaseService } from '../../services/database-service'
  import QueryCard from './QueryCard.svelte'
  
  interface Props {
    queries: Query[]
    analytics: RankingAnalytics[]
    onAddQuery: () => void
    onGetAISuggestions?: () => void
  }
  
  let { queries, analytics, onAddQuery, onGetAISuggestions }: Props = $props()

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
        const history = await DatabaseService.getQueryRankingHistory(query.id, 10)
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
    <div class="mb-6">
      <div class="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">No queries yet</h3>
      <p class="text-gray-600 mb-6">
        Add your first query to start analyzing rankings!
      </p>
    </div>
    
    <div class="flex flex-col sm:flex-row gap-3 justify-center">
      {#if onGetAISuggestions}
        <button
          onclick={onGetAISuggestions}
          class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 px-6 rounded-md transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          <span>Get AI Suggestions</span>
        </button>
      {/if}
      
      <button
        onclick={onAddQuery}
        class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-md transition-colors cursor-pointer flex items-center justify-center space-x-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        <span>Add Manually</span>
      </button>
    </div>
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
