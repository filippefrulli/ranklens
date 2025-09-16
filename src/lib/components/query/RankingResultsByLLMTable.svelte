<script lang="ts">
  import { getRankBadgeClass, formatRank } from '../../utils/ranking-utils'
  
  export let rankingResults: any[]

  import { getProviderDisplayName } from '$lib/constants/llm'

  function formatLLMName(llmName: string): string {
    if (!llmName) return 'Unknown Provider'
    return getProviderDisplayName(llmName)
  }

  // Aggregate results by LLM provider
  function aggregateResultsByLLM(results: any[]) {
    const llmMap = new Map()
    
    results.forEach(result => {
      const llmName = result.llm_providers?.name || 'Unknown'
      
      if (!llmMap.has(llmName)) {
        llmMap.set(llmName, {
          name: llmName,
          totalAttempts: 0,
          successfulAttempts: 0,
          foundRankings: [],
          averageRank: null,
          bestRank: null,
          worstRank: null
        })
      }
      
      const llmData = llmMap.get(llmName)
      llmData.totalAttempts++
      
      if (result.success) {
        llmData.successfulAttempts++
        
        if (result.target_business_rank !== null) {
          llmData.foundRankings.push(result.target_business_rank)
        }
      }
    })
    
    // Calculate statistics for each LLM
    llmMap.forEach((llmData, llmName) => {
      if (llmData.foundRankings.length > 0) {
        llmData.averageRank = llmData.foundRankings.reduce((sum: number, rank: number) => sum + rank, 0) / llmData.foundRankings.length
        llmData.bestRank = Math.min(...llmData.foundRankings)
        llmData.worstRank = Math.max(...llmData.foundRankings)
      }
    })
    
    return Array.from(llmMap.values()).sort((a, b) => {
      // Sort by average rank (lower is better), then by success rate
      if (a.averageRank !== null && b.averageRank !== null) {
        return a.averageRank - b.averageRank
      }
      if (a.averageRank !== null) return -1
      if (b.averageRank !== null) return 1
      // Fallback: more found occurrences (business located) is better
      return b.foundRankings.length - a.foundRankings.length
    })
  }

  // Count of times the target business was found (rank not null) is simply foundRankings.length

  $: aggregatedResults = aggregateResultsByLLM(rankingResults)
</script>

<div class="bg-white shadow rounded-lg">
  <div class="px-6 py-4 border-b border-gray-200">
    <h3 class="text-lg font-medium text-gray-900">Ranking Results by LLM</h3>
    <p class="mt-1 text-sm text-gray-500">Performance comparison across different LLM providers</p>
  </div>
  
  {#if rankingResults.length === 0}
    <div class="p-6 text-center">
      <div class="mx-auto h-12 w-12 text-gray-400">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
      <p class="text-gray-600">Run an analysis to see LLM comparison results.</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              LLM Provider
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Found (count)
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Average Rank
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Best Rank
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each aggregatedResults as llm}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {formatLLMName(llm.name)}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {llm.foundRankings.length}/{llm.totalAttempts}
                </div>
                <div class="text-xs text-gray-500">business found</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                {#if llm.averageRank !== null}
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getRankBadgeClass(llm.averageRank)}">
                    {formatRank(llm.averageRank)}
                  </span>
                {:else}
                  <span class="text-gray-400 text-sm">—</span>
                {/if}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                {#if llm.bestRank !== null}
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getRankBadgeClass(llm.bestRank)}">
                    {formatRank(llm.bestRank)}
                  </span>
                {:else}
                  <span class="text-gray-400 text-sm">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
