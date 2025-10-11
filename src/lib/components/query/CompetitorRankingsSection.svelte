<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import LoadingSpinner from "$lib/components/ui/LoadingSpinner.svelte";
  import CompetitorRankingsTable from "./CompetitorRankingsTable.svelte";
  import type { LLMProvider } from "$lib/types";

  interface Props {
    loadingData: boolean
    selectedRunId: string | null
    competitorRankings: any[]
    selectedProvider: LLMProvider | null
    analysisRunsCount: number
  }

  let { 
    loadingData, 
    selectedRunId, 
    competitorRankings, 
    selectedProvider,
    analysisRunsCount
  }: Props = $props();
</script>

<div class="-mt-2">
  {#if loadingData}
    <Card padding="p-8" custom="text-center">
      <LoadingSpinner message="Loading run data..." />
    </Card>
  {:else if selectedRunId && competitorRankings.length > 0}
    <Card padding="p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-slate-700">
          Competitor Rankings
        </h3>
        <span class="text-[11px] text-slate-500"
          >{competitorRankings.length} businesses</span
        >
      </div>
      <CompetitorRankingsTable {competitorRankings} />
    </Card>
  {:else if selectedRunId}
    <Card padding="p-10" custom="text-center">
      <p class="text-sm text-slate-500">
        {selectedProvider
          ? "No competitor rankings for selected provider and run."
          : "No competitor rankings for this run yet."}
      </p>
    </Card>
  {:else if analysisRunsCount === 0}
    <Card padding="p-10" custom="text-center">
      <p class="text-sm text-slate-500">
        No analysis runs found for this query. Run an analysis to see
        results.
      </p>
    </Card>
  {/if}
</div>
