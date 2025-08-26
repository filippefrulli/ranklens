<script lang="ts">
  export let competitorRankings: any[]

  function getRankBadgeClass(rank: number): string {
    if (rank <= 3) return 'bg-green-100 text-green-800'
    if (rank <= 7) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  function getAppearancePercentage(appearances: number, totalAttempts: number): string {
    return ((appearances / totalAttempts) * 100).toFixed(1)
  }

  function getConsistencyBadge(appearanceRate: number) {
    if (appearanceRate >= 0.8) return { class: 'bg-green-100 text-green-800', text: 'Highly Consistent' }
    if (appearanceRate >= 0.6) return { class: 'bg-yellow-100 text-yellow-800', text: 'Moderately Consistent' }
    if (appearanceRate >= 0.4) return { class: 'bg-orange-100 text-orange-800', text: 'Somewhat Consistent' }
    return { class: 'bg-red-100 text-red-800', text: 'Inconsistent' }
  }

  function getWeightedScoreBadge(score: number) {
    if (score <= 5) return 'bg-red-100 text-red-800'
    if (score <= 15) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }
</script>

<div class="bg-white shadow rounded-lg overflow-hidden mt-6">
  <div class="px-6 py-4 border-b border-gray-200">
    <h2 class="text-lg font-semibold text-gray-900">Competitive Landscape Analysis</h2>
    <p class="text-sm text-gray-600 mt-1">
      Complete ranking overview including your business and competitors, sorted by weighted score
    </p>
  </div>

  {#if competitorRankings.length === 0}
    <div class="p-6 text-center">
      <div class="text-gray-400 mb-4">
        <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">No Analysis Data Available</h3>
      <p class="text-gray-600">Run an analysis to see your business ranking and competitor landscape.</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Competitor Business
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Weighted Score
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Average Rank
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Consistency
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Frequency
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each competitorRankings as competitor, index}
            <tr class="hover:bg-gray-50 {competitor.is_user_business ? 'bg-blue-50/80 border-l-4 border-blue-500 ring-2 ring-blue-400' : ''}" aria-current={competitor.is_user_business ? 'true' : 'false'}>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center {competitor.is_user_business ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}">
                    <span class="text-sm font-semibold">#{index + 1}</span>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm {competitor.is_user_business ? 'text-blue-900 font-semibold' : 'text-gray-900 font-medium'}">
                      {competitor.business_name}
                      {#if competitor.is_user_business}
                        <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white">
                          Your Business
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getWeightedScoreBadge(competitor.weighted_score)}">
                  {competitor.weighted_score?.toFixed(1) || 'N/A'}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getRankBadgeClass(competitor.average_rank)}">
                  #{competitor.average_rank?.toFixed(1) || 'N/A'}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {getConsistencyBadge(competitor.appearance_rate || competitor.appearances_count / competitor.total_attempts).class}">
                  {getConsistencyBadge(competitor.appearance_rate || competitor.appearances_count / competitor.total_attempts).text}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      class="bg-blue-600 h-2 rounded-full" 
                      style="width: {getAppearancePercentage(competitor.appearances_count, competitor.total_attempts)}%"
                    ></div>
                  </div>
                  <span class="text-sm text-gray-600">
                    {getAppearancePercentage(competitor.appearances_count, competitor.total_attempts)}%
                  </span>
                  <span class="text-xs text-gray-500 ml-1">
                    ({competitor.appearances_count}/{competitor.total_attempts})
                  </span>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if competitorRankings.length > 0}
      <div class="bg-gray-50 px-6 py-3">
        <p class="text-sm text-gray-600">
          <strong>Weighted Analysis:</strong> Results are ranked by weighted score that considers both average rank and appearance consistency. 
          A business appearing in 100% of attempts at rank #15 scores better than one appearing once at rank #14.
        </p>
        <p class="text-xs text-gray-500 mt-1">
          Formula: Weighted Score = Average Rank × (2 - Appearance Rate). Lower scores indicate stronger competitors.
        </p>
      </div>
    {/if}
  {/if}
</div>
