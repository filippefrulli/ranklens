<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import RankingResultsByLLMTable from "./RankingResultsByLLMTable.svelte";
  import type { RankingAttempt, LLMProvider } from "$lib/types";

  interface Props {
    selectedRunId: string | null
    filteredRankingResults: RankingAttempt[]
    selectedProvider: LLMProvider | null
  }

  let { selectedRunId, filteredRankingResults, selectedProvider }: Props = $props();
</script>

<div class="lg:col-span-7">
  {#if selectedRunId && filteredRankingResults && filteredRankingResults.length > 0}
    <Card padding="p-6">
      <h3 class="text-sm font-semibold text-slate-700 mb-4">
        LLM Ranking Attempts
      </h3>
      <RankingResultsByLLMTable
        rankingResults={filteredRankingResults}
      />
    </Card>
  {:else if selectedRunId}
    <Card padding="p-10" custom="flex items-center justify-center">
      <p class="text-sm text-slate-500">
        {selectedProvider
          ? "No LLM results for selected provider and run"
          : "No LLM results for selected run yet"}
      </p>
    </Card>
  {:else}
    <Card padding="p-10" custom="flex items-center justify-center">
      <p class="text-sm text-slate-500">
        Select a run to view provider attempts
      </p>
    </Card>
  {/if}
</div>
