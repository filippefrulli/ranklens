<script lang="ts">
  import { onMount } from 'svelte'
  import type { Query, RankingAnalytics, QueryRankingHistory } from '../../types'
  import QueryCard from './QueryCard.svelte'
  import Button from '../ui/Button.svelte'
  
  interface Props {
    queries: Query[]
    analytics: RankingAnalytics[]
    queryHistories?: Map<string, QueryRankingHistory[]> // Pass from server instead
    onAddQuery: () => void
    onGetAISuggestions?: () => void
  }
  
  let { queries, analytics, queryHistories = new Map(), onAddQuery, onGetAISuggestions }: Props = $props()

  // For now, we'll keep the client-side loading but make it optional
  // TODO: Move this to server-side data loading
  let loadingHistories = $state(false)

  // Reactive update when queries change - only load if not provided
  $effect(() => {
    if (queries.length > 0 && queryHistories.size === 0) {
      // TODO: This should be moved to server-side
      // For now, we'll just use empty histories to avoid the error
      console.warn('QueryGrid: History data should be loaded server-side')
    }
  })
</script>

{#if queries.length === 0}
  <div class="text-center py-12 bg-white rounded-lg shadow-sm">
    <div class="mb-6">
  <div class="w-16 h-16 mx-auto bg-black/5 rounded-full flex items-center justify-center mb-4">
  <svg class="w-8 h-8 text-[rgb(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <Button
          onClick={() => onGetAISuggestions?.()}
          variant="primary"
          size="md"
          class="bg-gradient-to-r from-purple-600 to-[rgb(var(--color-primary))] hover:from-purple-700 hover:to-[rgb(var(--color-primary))] px-6 py-3 space-x-2"
        >
          {@const _=null}
          <span class="inline-flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Get AI Suggestions</span>
        </Button>
      {/if}
      
      <Button
        onClick={() => onAddQuery()}
        variant="secondary"
        size="md"
        class="px-6 py-3 flex items-center justify-center space-x-2"
      >
        {@const _=null}
        <span class="inline-flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>Add Manually</span>
      </Button>
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