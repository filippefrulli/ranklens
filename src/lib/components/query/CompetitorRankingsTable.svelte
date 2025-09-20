<script lang="ts">
  import { getRankBadgeClass, formatRank } from "../../utils/ranking-utils";

  export let competitorRankings: any[];

  // Sort by weighted_score (ascending: lower score = better). Missing scores go last.
  function sortByWeightedScore(list: any[]): any[] {
    return [...list].sort((a, b) => {
      const aw =
        typeof a?.weighted_score === "number"
          ? a.weighted_score
          : Number.POSITIVE_INFINITY;
      const bw =
        typeof b?.weighted_score === "number"
          ? b.weighted_score
          : Number.POSITIVE_INFINITY;
      return aw - bw;
    });
  }

  let sortedCompetitors = sortByWeightedScore(competitorRankings);
  $: sortedCompetitors = sortByWeightedScore(competitorRankings);

  // Display logic: show all competitors up to and including the user business, plus the next 5 after it.
  // If user business not present, fall back to a larger top segment (top 20) so user can scan a broader field.
  function buildDisplayed(list: any[]): any[] {
    if (!Array.isArray(list) || list.length === 0) return [];
    const FOLLOWING = 5;
    const FALLBACK_SIZE = 20;
    const userIdx = list.findIndex((c) => c?.is_user_business);
    if (userIdx === -1) {
      return list.slice(0, FALLBACK_SIZE);
    }
    const endExclusive = Math.min(list.length, userIdx + 1 + FOLLOWING);
    return list.slice(0, endExclusive);
  }
  let displayedCompetitors = buildDisplayed(sortedCompetitors);
  $: displayedCompetitors = buildDisplayed(sortedCompetitors);

  function getAppearancePercentage(
    appearances: number,
    totalAttempts: number
  ): string {
    return ((appearances / totalAttempts) * 100).toFixed(1);
  }

  function getConsistencyBadge(appearanceRate: number) {
    if (appearanceRate >= 0.8)
      return {
        class: "bg-green-100 text-green-800",
        text: "Highly Consistent",
      };
    if (appearanceRate >= 0.6)
      return {
        class: "bg-yellow-100 text-yellow-800",
        text: "Moderately Consistent",
      };
    if (appearanceRate >= 0.4)
      return {
        class: "bg-orange-100 text-orange-800",
        text: "Somewhat Consistent",
      };
    return { class: "bg-red-100 text-red-800", text: "Inconsistent" };
  }

  function getWeightedScoreBadge(score: number) {
    if (score <= 5) return "bg-red-100 text-red-800";
    if (score <= 15) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  }
</script>

<div class="bg-white shadow rounded-lg overflow-hidden mt-6">
  {#if competitorRankings.length === 0}
    <div class="p-6 text-center">
      <div class="text-gray-400 mb-4">
        <svg
          class="mx-auto h-12 w-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          ></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        No Analysis Data Available
      </h3>
      <p class="text-gray-600">
        Run an analysis to see your business ranking and competitor landscape.
      </p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Competitor Business
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Weighted Score <span
                class="ml-1 text-[10px] font-normal text-gray-400"
                title="Sorted ascending (lower = better)">▲</span
              >
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Average Rank
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Consistency
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Frequency
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each displayedCompetitors as competitor}
            <tr
              class="hover:bg-gray-50 {competitor.is_user_business
                ? 'bg-blue-50/80 border-l-4 border-blue-500 ring-2 ring-blue-400'
                : ''}"
              aria-current={competitor.is_user_business ? "true" : "false"}
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div
                    class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center {competitor.is_user_business
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'}"
                    title="Rank position in full sorted list"
                  >
                    <span class="text-sm font-semibold"
                      >#{sortedCompetitors.findIndex((c) => c === competitor) +
                        1}</span
                    >
                  </div>
                  <div class="ml-4">
                    <div
                      class="text-sm {competitor.is_user_business
                        ? 'text-blue-900 font-semibold'
                        : 'text-gray-900 font-medium'}"
                    >
                      {competitor.business_name}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getWeightedScoreBadge(
                    competitor.weighted_score
                  )}"
                >
                  {competitor.weighted_score?.toFixed(1) || "N/A"}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getRankBadgeClass(
                    competitor.average_rank
                  )}"
                >
                  {formatRank(competitor.average_rank)}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="inline-flex px-2 py-1 text-xs font-medium rounded-full {getConsistencyBadge(
                    competitor.appearances_count / competitor.total_attempts
                  ).class}"
                >
                  {getConsistencyBadge(
                    competitor.appearances_count / competitor.total_attempts
                  ).text}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                    <div
                      class="bg-blue-600 h-2 rounded-full"
                      style="width: {getAppearancePercentage(
                        competitor.appearances_count,
                        competitor.total_attempts
                      )}%"
                    ></div>
                  </div>
                  <span class="text-sm text-gray-600">
                    {getAppearancePercentage(
                      competitor.appearances_count,
                      competitor.total_attempts
                    )}%
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
          <strong>Weighted Analysis:</strong><br/> Results are ranked by weighted score
          that considers both average rank and appearance consistency.
        </p>
        <p class="text-sm text-gray-600">A business
          appearing in 100% of attempts at rank #15 scores better than one appearing
          once at rank #14.</p>
      </div>
    {/if}
  {/if}
</div>
