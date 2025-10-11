<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import ErrorMessage from "../../../lib/components/ui/ErrorMessage.svelte";
  import type { Query, RankingAttempt, LLMProvider } from "../../../lib/types";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { loadRun, saveRun } from "$lib/utils/queryRunCache";
  import QueryHeader from "$lib/components/query/QueryHeader.svelte";
  import AnalysisRunsList from "$lib/components/query/AnalysisRunsList.svelte";
  import LLMResultsSection from "$lib/components/query/LLMResultsSection.svelte";
  import CompetitorRankingsSection from "$lib/components/query/CompetitorRankingsSection.svelte";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();

  const user = $derived(data.user);
  const supabase = $derived(data.supabase);
  let query = $state<Query | null>(data.query);
  let analysisRuns = $state<{ id: string; created_at: string }[]>(
    data.analysisRuns
  );
  let selectedRunId = $state<string | null>(null);
  let rankingResults = $state<RankingAttempt[]>([]);
  // Raw rows from competitor_results for the selected run
  let rawCompetitorResults = $state<any[]>([]);
  // Derived table data for display
  let competitorRankings = $state<any[]>([]);
  let llmProviders = $state<LLMProvider[]>(data.llmProviders);
  let selectedProvider = $state<LLMProvider | null>(null);
  let loadingData = $state(false);
  let error = $state<string | null>(null);
  let queryId = $derived($page.params.id || "");

  let filteredRankingResults = $derived.by(() => {
    if (!selectedProvider) return rankingResults;
    const providerId = selectedProvider?.id;
    return rankingResults.filter((r) => r.llm_provider_id === providerId);
  });


  onMount(() => {
    if (analysisRuns.length > 0) {
      selectedRunId = analysisRuns[0].id;
      loadRunData(analysisRuns[0].id);
    }
  });

  async function loadRunData(runId: string) {
    if (!queryId || !runId) return;
    try {
      loadingData = true;
      // Try cache first
      const cached = loadRun(queryId, runId);
      if (cached && (cached as any).v === 2 && (cached as any).rawCompetitorResults) {
        // Cache hit with current version
        rankingResults = cached.rankingResults;
        rawCompetitorResults = (cached as any).rawCompetitorResults;
      } else {
        // Fetch from server API endpoint
        const response = await fetch(
          `/api/query/${encodeURIComponent(queryId)}/run-data?runId=${encodeURIComponent(runId)}&_=${Date.now()}`,
          { credentials: 'include' }
        );
        
        if (!response.ok) {
          throw new Error('Failed to load run data');
        }
        
        const data = await response.json();
        rankingResults = data.rankingResults;
        rawCompetitorResults = data.competitorResults;
        
        // Save to cache
        saveRun(queryId, runId, rankingResults, rawCompetitorResults);
      }

      // Build display data based on selection from RAW rows
      competitorRankings = buildCompetitorDisplay(rawCompetitorResults, selectedProvider?.name || null);
    } catch (e: any) {
      error = 'Failed to load run data';
    } finally {
      loadingData = false;
    }
  }

  async function onProviderChange(provider: LLMProvider | null) {
    selectedProvider = provider;
    // Recompute display table from cached raw rows
    competitorRankings = buildCompetitorDisplay(rawCompetitorResults, selectedProvider?.name || null);
    if (selectedRunId && rankingResults.length === 0) await loadRunData(selectedRunId);
  }
  
  async function selectRun(runId: string) {
    if (runId !== selectedRunId) {
      selectedRunId = runId;
      await loadRunData(runId);
    }
  }
  
  function goBack() {
    goto("/");
  }

  // Helper: build display table from raw competitor rows, optionally filtered by provider name
  function buildCompetitorDisplay(rawRows: any[], providerName: string | null): any[] {
    if (!Array.isArray(rawRows) || rawRows.length === 0) return [];

    // If filtering by a provider, restrict to rows that include that provider
    const rows = providerName
      ? rawRows.filter((r) => Array.isArray(r.llm_providers) && r.llm_providers.includes(providerName))
      : rawRows;

    if (!providerName) {
      // Combined view: group by business and average across providers
      const groups = new Map<string, any>();
      rows.forEach((c) => {
        const key = c.business_name;
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
          if (c.business_name === g.business_name) {
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
        queryText={query.text}
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
