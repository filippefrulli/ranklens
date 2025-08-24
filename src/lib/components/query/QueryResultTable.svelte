<script lang="ts">
  import type { RankingAttemptWithJoins } from '../../types'
  
  export let rankingResults: RankingAttemptWithJoins[]

  function formatLLMName(llmName: string): string {
    if (!llmName) return 'Unknown Provider'
    
    switch (llmName.toLowerCase()) {
      case 'openai':
        return 'OpenAI GPT-5'
      case 'anthropic':
        return 'Anthropic Claude'
      case 'gemini':
        return 'Google Gemini'
      case 'perplexity':
        return 'Perplexity'
      default:
        return llmName
    }
  }

  function getStatusBadgeClass(status: string): string {
    if (!status) return 'bg-gray-100 text-gray-800'
    
    switch (status) {
      case 'found':
        return 'bg-green-100 text-green-800'
      case 'not_found':
        return 'bg-red-100 text-red-800'
      case 'error':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function getRankBadgeClass(rank: number | null | undefined): string {
    if (rank === null || rank === undefined) return 'bg-gray-100 text-gray-800'
    if (rank <= 3) return 'bg-green-100 text-green-800'
    if (rank <= 7) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  function getStatus(result: any): string {
    if (!result.success) return 'error'
    if (result.target_business_rank !== null) return 'found'
    return 'not_found'
  }

  function getStatusText(result: any): string {
    if (!result.success) return 'Error'
    if (result.target_business_rank !== null) return 'Found'
    return 'Not Found'
  }
</script>

<div class="bg-white shadow rounded-lg overflow-hidden">
  <div class="px-6 py-4 border-b border-gray-200">
    <h2 class="text-lg font-semibold text-gray-900">Ranking Results by LLM</h2>
    <p class="text-sm text-gray-600 mt-1">
      Detailed results from each LLM provider showing individual rankings and analysis attempts
    </p>
  </div>

  {#if rankingResults.length === 0}
    <div class="p-6 text-center">
      <div class="text-gray-400 mb-4">
        <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
      <p class="text-gray-600">Run an analysis to see ranking results for this query.</p>
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
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rank
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each rankingResults as result}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {formatLLMName(result.llm_providers?.name)}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusBadgeClass(getStatus(result))}">
                  {getStatusText(result)}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                {#if result.target_business_rank !== null}
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getRankBadgeClass(result.target_business_rank)}">
                    #{result.target_business_rank}
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
