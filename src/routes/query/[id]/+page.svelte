<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import RankingResultsByLLMTable from "../../../lib/components/query/RankingResultsByLLMTable.svelte";
  import CompetitorRankingsTable from "../../../lib/components/query/CompetitorRankingsTable.svelte";
  import LoadingSpinner from "../../../lib/components/ui/LoadingSpinner.svelte";
  import ErrorMessage from "../../../lib/components/ui/ErrorMessage.svelte";
  import type { Query, RankingAttempt, LLMProvider } from "../../../lib/types";
  import Card from "$lib/components/ui/Card.svelte";
  import { loadRun, saveRun } from "$lib/utils/queryRunCache";

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
      let competitorData: any[] | null = null;
      if (cached) {
        rankingResults = cached.rankingResults;
        competitorData = cached.competitorRankings;
      } else {
        const { data: rankings, error: rankingsError } = await supabase
          .from("ranking_attempts")
          .select(
            `*, analysis_runs!inner(id, created_at), llm_providers!inner(id, name)`
          )
          .eq("query_id", queryId)
          .eq("analysis_run_id", runId)
          .order("created_at", { ascending: false });
        if (rankingsError)
          throw new Error(
            `Failed to fetch ranking results: ${rankingsError.message}`
          );
        rankingResults = rankings || [];

        const { data: competitorDataRaw, error: competitorError } =
          await supabase
            .from("competitor_results")
            .select("*")
            .eq("query_id", queryId)
            .eq("analysis_run_id", runId)
            .order("average_rank", { ascending: true });
        if (competitorError)
          throw new Error(
            `Failed to fetch competitor rankings: ${competitorError.message}`
          );
        competitorData = competitorDataRaw || [];
      }

      let competitors = competitorData || [];
      if (selectedProvider) {
        competitors = competitors.filter(
          (c) =>
            c.llm_providers && c.llm_providers.includes(selectedProvider!.name)
        );
      } else {
        const groups = new Map();
        competitors.forEach((c) => {
          const key = c.business_name;
          if (!groups.has(key)) {
            groups.set(key, {
              ...c,
              allRanks: [...c.raw_ranks],
              allProviders: [...c.llm_providers],
              totalAppearances: c.appearances_count,
              totalProviderAttempts: c.total_attempts,
            });
          } else {
            const g = groups.get(key);
            g.allRanks.push(...c.raw_ranks);
            c.llm_providers.forEach((p: string) => {
              if (!g.allProviders.includes(p)) g.allProviders.push(p);
            });
            g.totalAppearances += c.appearances_count;
            g.totalProviderAttempts += c.total_attempts;
          }
        });
        competitors = Array.from(groups.values()).map((g) => {
          const providerAverages: number[] = [];
          const providerWeighted: number[] = [];
          competitorData?.forEach((c) => {
            if (c.business_name === g.business_name) {
              providerAverages.push(c.average_rank);
              providerWeighted.push(c.weighted_score);
            }
          });
          const avg =
            providerAverages.reduce((s, v) => s + v, 0) /
            providerAverages.length;
          const weighted =
            providerWeighted.reduce((s, v) => s + v, 0) /
            providerWeighted.length;
          return {
            ...g,
            average_rank: Number(avg.toFixed(2)),
            best_rank: Math.min(...g.allRanks),
            worst_rank: Math.max(...g.allRanks),
            appearances_count: g.totalAppearances,
            total_attempts: g.totalProviderAttempts,
            weighted_score: Number(weighted.toFixed(2)),
            llm_providers: g.allProviders,
            raw_ranks: g.allRanks,
          };
        });
      }
      competitorRankings = competitors;
      // Save to cache if freshly fetched (no cache before)
      if (!cached) {
        saveRun(queryId, runId, rankingResults, competitorRankings);
      }
    } catch (e: any) {
      console.error("Error loading run data", e);
      error = e.message || "Failed to load run data";
    } finally {
      loadingData = false;
    }
  }

  async function onProviderChange(provider: LLMProvider | null) {
    selectedProvider = provider;
    if (selectedRunId) await loadRunData(selectedRunId);
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
  function formatDate(d: string) {
    return new Date(d).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
    {#if error}
      <ErrorMessage {error} onDismiss={() => (error = null)} />
      <button
        onclick={() => goBack()}
        class="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
        >← Back to Dashboard</button
      >
    {:else if query}
      <!-- Header -->
      <div class="flex items-start justify-between flex-col md:flex-row gap-4">
        <div>
          <div class="flex items-center gap-3">
            <button
              onclick={() => goBack()}
              class="text-slate-500 hover:text-slate-700 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium cursor-pointer"
              >← Back</button
            >
            <h1 class="text-xl font-semibold text-slate-800">
              Query: <span class="text-slate-900">{query.text}</span>
            </h1>
          </div>
        </div>
        <!-- Provider Pills -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors {selectedProvider ===
            null
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-slate-300 text-slate-600 hover:bg-slate-100'}"
            onclick={() => onProviderChange(null)}>All</button
          >
          {#each llmProviders as provider}
            <button
              class="px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors flex items-center gap-1 {selectedProvider?.id ===
              provider.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'}"
              onclick={() => onProviderChange(provider)}
            >
              <span
                class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[10px] font-semibold text-slate-600"
                >{provider.name?.[0] || "P"}</span
              >
              {provider.name}
            </button>
          {/each}
        </div>
        LLM Ranking Attempts
      </div>

      <!-- Runs & LLM results -->
      <div class="grid gap-6 lg:grid-cols-12">
        <!-- Runs list -->
        <Card padding="p-6" custom="lg:col-span-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-slate-700 tracking-wide">
              Analysis Runs
            </h3>
            <span class="text-[11px] text-slate-500"
              >{analysisRuns.length} total</span
            >
          </div>
          {#if analysisRuns.length > 0}
            <div class="space-y-2">
              {#each analysisRuns as run (run.id)}
                <button
                  type="button"
                  class="w-full text-left p-3 rounded-lg border transition-colors cursor-pointer {selectedRunId ===
                  run.id
                    ? 'bg-blue-50 border-blue-400'
                    : 'bg-white border-slate-200 hover:border-slate-300'}"
                  onclick={() => selectRun(run.id)}
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-slate-700"
                      >{formatDate(run.created_at)}</span
                    >
                    {#if selectedRunId === run.id}
                      <span
                        class="inline-flex items-center rounded-full bg-blue-600 text-white px-2 py-0.5 text-[10px] font-medium"
                        >Active</span
                      >
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-slate-500">
              No runs yet. Trigger an analysis from the dashboard.
            </p>
          {/if}
        </Card>

        <!-- LLM Results table / placeholder -->
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
      </div>

      <!-- Competitor Rankings -->
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
        {:else if analysisRuns.length === 0}
          <Card padding="p-10" custom="text-center">
            <p class="text-sm text-slate-500">
              No analysis runs found for this query. Run an analysis to see
              results.
            </p>
          </Card>
        {/if}
      </div>
    {:else}
      <Card padding="p-12" custom="text-center">
        <p class="text-sm text-slate-500">Loading query…</p>
      </Card>
    {/if}
  </div>
</div>
