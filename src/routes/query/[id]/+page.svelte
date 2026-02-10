<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import ErrorMessage from "../../../lib/components/ui/ErrorMessage.svelte";
  import type { Measurement, RankingAttempt, LLMProvider } from "../../../lib/types";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import QueryHeader from "$lib/components/query/QueryHeader.svelte";
  import AnalysisRunsList from "$lib/components/query/AnalysisRunsList.svelte";
  import LLMResultsSection from "$lib/components/query/LLMResultsSection.svelte";
  import CompetitorRankingsSection from "$lib/components/query/CompetitorRankingsSection.svelte";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();

  const user = $derived(data.user);
  let query = $state<Measurement | null>(data.query);
  let analysisRuns = $state<{ id: string; created_at: string }[]>(
    data.analysisRuns
  );
  let selectedRunId = $state<string | null>(data.selectedRunId);
  let rankingResults = $state<RankingAttempt[]>(data.rankingResults || []);
  let rawCompetitorResults = $state<any[]>(data.competitorResults || []);
  let competitorRankings = $state<any[]>([]);
  let llmProviders = $state<LLMProvider[]>(data.llmProviders);
  let selectedProvider = $state<LLMProvider | null>(null);
  let loadingData = $state(false);
  let error = $state<string | null>(null);
  let queryId = $derived($page.params.id || "");

  // Sync state when data changes from server
  $effect(() => {
    query = data.query;
    analysisRuns = data.analysisRuns;
    selectedRunId = data.selectedRunId;
    rankingResults = data.rankingResults || [];
    rawCompetitorResults = data.competitorResults || [];
    llmProviders = data.llmProviders;
  });

  // Rebuild display when raw data or provider filter changes
  $effect(() => {
    competitorRankings = buildCompetitorDisplay(rawCompetitorResults, selectedProvider?.name || null);
  });

  let filteredRankingResults = $derived.by(() => {
    if (!selectedProvider) return rankingResults;
    const providerId = selectedProvider?.id;
    return rankingResults.filter((r) => r.llm_provider_id === providerId);
  });

  function onProviderChange(provider: LLMProvider | null) {
    selectedProvider = provider;
    // The $effect will automatically rebuild competitorRankings
  }
  
  async function selectRun(runId: string) {
    if (runId !== selectedRunId) {
      // Update URL with selected run - this triggers load function re-run
      const url = new URL(window.location.href);
      url.searchParams.set('run', runId);
      await goto(url.pathname + url.search, { keepFocus: true });
    }
  }
  
  function goBack() {
    goto("/dashboard");
  }

  // Helper: build display table from raw competitor rows, optionally filtered by provider name
  function buildCompetitorDisplay(rawRows: any[], providerName: string | null): any[] {
    if (!Array.isArray(rawRows) || rawRows.length === 0) return [];

    // If filtering by a provider, restrict to rows that include that provider
    const rows = providerName
      ? rawRows.filter((r) => Array.isArray(r.llm_providers) && r.llm_providers.includes(providerName))
      : rawRows;

    if (!providerName) {
      // Combined view: group by product and average across providers
      const groups = new Map<string, any>();
      rows.forEach((c) => {
        const key = c.product_name;
        if (!groups.has(key)) {
          groups.set(key, {
            ...c,
            allRanks: [...(c.raw_ranks || [])],
            allProviders: [...(c.llm_providers || [])],
            totalAppearances: c.appearances_count,
            totalProviderAttempts: c.total_attempts,
          });
        } else {
          const g = groups.get(key);
          g.allRanks.push(...(c.raw_ranks || []));
          (c.llm_providers || []).forEach((p: string) => {
            if (!g.allProviders.includes(p)) g.allProviders.push(p);
          });
          g.totalAppearances += c.appearances_count;
          g.totalProviderAttempts += c.total_attempts;
        }
      });
      return Array.from(groups.values()).map((g) => {
        const providerAverages: number[] = [];
        const providerWeighted: number[] = [];
        rows.forEach((c) => {
          if (c.product_name === g.product_name) {
            providerAverages.push(c.average_rank);
            providerWeighted.push(c.weighted_score);
          }
        });
        const avg = providerAverages.length > 0
          ? providerAverages.reduce((s, v) => s + v, 0) / providerAverages.length
          : NaN;
        const weighted = providerWeighted.length > 0
          ? providerWeighted.reduce((s, v) => s + v, 0) / providerWeighted.length
          : NaN;
        return {
          ...g,
          average_rank: Number.isFinite(avg) ? Number(avg.toFixed(2)) : null,
          best_rank: Math.min(...g.allRanks),
          worst_rank: Math.max(...g.allRanks),
          appearances_count: g.totalAppearances,
          total_attempts: g.totalProviderAttempts,
          weighted_score: Number.isFinite(weighted) ? Number(weighted.toFixed(2)) : null,
          llm_providers: g.allProviders,
          raw_ranks: g.allRanks,
        };
      });
    }

    // Single-provider view: rows already per-business for that provider; pass through
    return rows.map((c) => ({ ...c }));
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
    {#if error}
      <ErrorMessage {error} onDismiss={() => (error = null)} />
      <Button
        variant="subtle"
        size="md"
        onClick={() => goBack()}
        class="mt-4 bg-transparent hover:bg-transparent text-[rgb(var(--color-primary))] px-4 py-2 text-sm"
      >← Back to Dashboard</Button>
    {:else if query}
      <QueryHeader 
        queryText={query.title || query.query}
        {llmProviders}
        {selectedProvider}
        onBack={goBack}
        {onProviderChange}
      />

      <!-- Runs & LLM results -->
      <div class="grid gap-6 lg:grid-cols-12">
        <AnalysisRunsList 
          {analysisRuns}
          {selectedRunId}
          onSelectRun={selectRun}
        />

        <LLMResultsSection 
          {selectedRunId}
          {filteredRankingResults}
          {selectedProvider}
        />
      </div>

      <CompetitorRankingsSection 
        {loadingData}
        {selectedRunId}
        {competitorRankings}
        {selectedProvider}
        analysisRunsCount={analysisRuns.length}
      />
    {:else}
      <Card padding="p-12" custom="text-center">
        <p class="text-sm text-slate-500">Loading query…</p>
      </Card>
    {/if}
  </div>
</div>
