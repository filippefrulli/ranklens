<script lang="ts">
  import { goto } from "$app/navigation";
  import { invalidate } from "$app/navigation";
  import { browser } from "$app/environment";
  import { enhance } from "$app/forms";
  import type { PageData } from "./$types";
  import type { Measurement, Product, LLMProvider, AnalysisRun, MeasurementRankingHistory } from "$lib/types";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import CompetitorRankingsTable from "$lib/components/query/CompetitorRankingsTable.svelte";
  import LLMLogo from "$lib/components/logos/LLMLogo.svelte";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();

  let measurement = $derived<Measurement>(data.measurement);
  let product = $derived<Product>(data.product);
  let analysisRuns = $derived(data.analysisRuns ?? []);
  let llmProviders = $derived<LLMProvider[]>(data.llmProviders ?? []);
  let selectedRunId = $state<string | null>(data.selectedRunId);
  let rankingResults = $state<any[]>(data.rankingResults ?? []);
  let rawCompetitorResults = $state<any[]>(data.competitorResults ?? []);
  let rankingHistory = $state<MeasurementRankingHistory[]>(data.rankingHistory ?? []);

  // Running analysis state
  let runningAnalysis = $state<AnalysisRun | null>(data.runningAnalysis ?? null);
  let justStartedAnalysis = $state(false);
  let loading = $state(false);
  let loadingRunData = $state(false);

  // Tabs
  let activeTab = $state<'results' | 'history'>('results');

  // LLM filter
  let selectedProvider = $state<LLMProvider | null>(null);
  let llmDropdownOpen = $state(false);

  // Sync from server
  $effect(() => {
    selectedRunId = data.selectedRunId;
    rankingResults = data.rankingResults ?? [];
    rawCompetitorResults = data.competitorResults ?? [];
    loadingRunData = false;
    rankingHistory = data.rankingHistory ?? [];
    const prop = data.runningAnalysis ?? null;
    if (!prop) {
      if (!justStartedAnalysis && runningAnalysis && runningAnalysis.id !== 'temp') {
        stopPolling();
        // Reload data so the new results appear without a manual refresh
        if (browser) {
          invalidate('app:measurement-data');
        }
        setTimeout(() => { runningAnalysis = null; }, 3000);
      }
    } else if (prop.status === 'completed' || prop.status === 'failed') {
      runningAnalysis = { ...prop, status: 'completed' };
      stopPolling();
      // Reload data so the new results appear without a manual refresh
      if (browser) {
        invalidate('app:measurement-data');
      }
      setTimeout(() => { runningAnalysis = null; }, 3000);
    } else {
      runningAnalysis = prop;
      if (justStartedAnalysis) justStartedAnalysis = false;
    }
  });

  // Polling for analysis status
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function startPolling() {
    if (!browser || pollInterval) return;
    pollInterval = setInterval(async () => {
      try { await invalidate('app:measurement-data'); } catch {}
    }, 10000);
  }

  function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  $effect(() => {
    if (browser && runningAnalysis && runningAnalysis.id !== 'temp' &&
        (runningAnalysis.status === 'running' || runningAnalysis.status === 'pending')) {
      startPolling();
      return () => stopPolling();
    }
  });

  // Filtered results
  let filteredRankingResults = $derived.by(() => {
    if (!selectedProvider) return rankingResults;
    return rankingResults.filter((r) => r.llm_provider_id === selectedProvider?.id);
  });

  // Aggregated per-LLM breakdown
  let llmBreakdown = $derived.by(() => {
    if (filteredRankingResults.length === 0) return [];
    const groups = new Map<string, {
      provider_name: string,
      total_attempts: number,
      successful: number,
      failed: number,
      ranks: number[],
      found_count: number
    }>();
    for (const r of filteredRankingResults) {
      const name = r.llm_providers?.display_name || r.llm_providers?.name || 'Unknown';
      const id = r.llm_provider_id || name;
      if (!groups.has(id)) {
        groups.set(id, { provider_name: name, total_attempts: 0, successful: 0, failed: 0, ranks: [], found_count: 0 });
      }
      const g = groups.get(id)!;
      g.total_attempts++;
      if (r.success) g.successful++;
      else g.failed++;
      if (r.target_product_rank != null) {
        g.ranks.push(r.target_product_rank);
        g.found_count++;
      }
    }
    return Array.from(groups.values()).map(g => ({
      ...g,
      avg_rank: g.ranks.length > 0 ? g.ranks.reduce((a, b) => a + b, 0) / g.ranks.length : null,
      best_rank: g.ranks.length > 0 ? Math.min(...g.ranks) : null,
      worst_rank: g.ranks.length > 0 ? Math.max(...g.ranks) : null,
    }));
  });

  let competitorRankings = $derived.by(() => {
    return buildCompetitorDisplay(rawCompetitorResults, selectedProvider?.name || null);
  });

  // Determine current provider based on completed LLM calls
  // Analysis iterates: for each measurement → for each provider → 10 attempts
  const ATTEMPTS_PER_PROVIDER = 10;

  let currentProviderName = $derived.by(() => {
    if (llmProviders.length === 0) return 'LLMs';
    if (!runningAnalysis) return llmProviders[0]?.display_name ?? 'LLMs';

    const completed = runningAnalysis.completed_llm_calls || 0;
    const callsPerMeasurement = llmProviders.length * ATTEMPTS_PER_PROVIDER;
    // Which provider within the current measurement's cycle
    const positionInMeasurement = completed % callsPerMeasurement;
    const providerIndex = Math.floor(positionInMeasurement / ATTEMPTS_PER_PROVIDER);
    const safeIndex = Math.min(providerIndex, llmProviders.length - 1);

    return llmProviders[safeIndex]?.display_name ?? 'LLMs';
  });

  function onProviderChange(provider: LLMProvider | null) {
    selectedProvider = provider;
  }

  async function selectRun(runId: string) {
    if (runId !== selectedRunId) {
      selectedRunId = runId;
      loadingRunData = true;
      const url = new URL(window.location.href);
      url.searchParams.set('run', runId);
      goto(url.pathname + url.search, { keepFocus: true, noScroll: true });
    }
  }

  function goBack() {
    goto(`/product/${product.id}`);
  }

  function buildCompetitorDisplay(rawRows: any[], providerName: string | null): any[] {
    if (!Array.isArray(rawRows) || rawRows.length === 0) return [];

    const rows = providerName
      ? rawRows.filter((r) => Array.isArray(r.llm_providers) && r.llm_providers.includes(providerName))
      : rawRows;

    if (!providerName) {
      // Calculate total attempts across ALL providers (sum of each unique provider's attempts)
      const providerAttempts = new Map<string, number>();
      rawRows.forEach((c) => {
        (c.llm_providers || []).forEach((p: string) => {
          if (!providerAttempts.has(p)) {
            providerAttempts.set(p, c.total_attempts);
          }
        });
      });
      const grandTotalAttempts = Array.from(providerAttempts.values()).reduce((s, v) => s + v, 0);

      const groups = new Map<string, any>();
      rows.forEach((c) => {
        const key = c.product_name;
        if (!groups.has(key)) {
          groups.set(key, {
            ...c,
            allRanks: [...(c.raw_ranks || [])],
            allProviders: [...(c.llm_providers || [])],
            totalAppearances: c.appearances_count,
          });
        } else {
          const g = groups.get(key);
          g.allRanks.push(...(c.raw_ranks || []));
          (c.llm_providers || []).forEach((p: string) => {
            if (!g.allProviders.includes(p)) g.allProviders.push(p);
          });
          g.totalAppearances += c.appearances_count;
        }
      });
      return Array.from(groups.values()).map((g) => {
        const avgRank = g.allRanks.length > 0
          ? g.allRanks.reduce((s: number, v: number) => s + v, 0) / g.allRanks.length
          : NaN;
        const appearanceRate = grandTotalAttempts > 0 ? g.totalAppearances / grandTotalAttempts : 0;
        const weighted = Number.isFinite(avgRank)
          ? avgRank + 25 * Math.pow(1 - appearanceRate, 2)
          : NaN;
        return {
          ...g,
          average_rank: Number.isFinite(avgRank) ? Number(avgRank.toFixed(2)) : null,
          best_rank: Math.min(...g.allRanks),
          worst_rank: Math.max(...g.allRanks),
          appearances_count: g.totalAppearances,
          total_attempts: grandTotalAttempts,
          weighted_score: Number.isFinite(weighted) ? Number(weighted.toFixed(2)) : null,
          llm_providers: g.allProviders,
          raw_ranks: g.allRanks,
        };
      });
    }

    return rows.map((c) => ({ ...c }));
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatDateTime(d: string) {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }) + ' ' + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Provider colors for chart lines
  const providerColors = [
    '#6366f1', // indigo
    '#f59e0b', // amber
    '#10b981', // emerald
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
  ];

  // History chart data — overall + per-provider lines
  let sortedHistory = $derived.by(() => {
    if (rankingHistory.length === 0) return [];
    return [...rankingHistory].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  // Collect all unique providers across all history runs
  let historyProviders = $derived.by(() => {
    const providerMap = new Map<string, string>();
    for (const run of sortedHistory) {
      for (const pb of (run.provider_breakdown || [])) {
        if (!providerMap.has(pb.provider_id)) {
          providerMap.set(pb.provider_id, pb.provider_name);
        }
      }
    }
    return Array.from(providerMap.entries()).map(([id, name]) => ({ id, name }));
  });

  // Overall data points
  let historyDataPoints = $derived.by(() => {
    return sortedHistory.map(run => ({
      value: run.average_rank || 0,
      label: formatDateTime(run.created_at),
      tooltip: `Avg Rank ${run.average_rank?.toFixed(1) || 'N/A'} on ${formatDateTime(run.created_at)}`,
      best: run.best_rank,
      worst: run.worst_rank,
      attempts: run.total_attempts,
      successful: run.successful_attempts
    }));
  });

  // Per-provider data points (value per run, null if provider not in that run)
  let providerDataSeries = $derived.by(() => {
    return historyProviders.map((provider, idx) => {
      const points = sortedHistory.map(run => {
        const pb = (run.provider_breakdown || []).find(p => p.provider_id === provider.id);
        return pb?.average_rank ?? null;
      });
      return {
        id: provider.id,
        name: provider.name,
        color: providerColors[idx % providerColors.length],
        points
      };
    });
  });

  // Chart dimensions
  const chartHeight = 280;
  const chartWidth = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const innerWidth = chartWidth - padding.left - padding.right;

  // Compute yScale from all values (overall + per-provider)
  let allChartValues = $derived.by(() => {
    const vals: number[] = [];
    for (const dp of historyDataPoints) {
      if (dp.value > 0) vals.push(dp.value);
    }
    for (const series of providerDataSeries) {
      for (const v of series.points) {
        if (v != null && v > 0) vals.push(v);
      }
    }
    return vals;
  });

  let yScale = $derived.by(() => {
    if (allChartValues.length === 0) return (val: number) => innerHeight / 2;
    const maxRank = Math.max(...allChartValues, 10);
    const minRank = Math.min(...allChartValues, 1);
    const range = maxRank - minRank || 1;
    return (rank: number) => innerHeight - ((rank - minRank) / range) * innerHeight;
  });

  function xScale(index: number): number {
    if (historyDataPoints.length <= 1) return innerWidth / 2;
    return (index / (historyDataPoints.length - 1)) * innerWidth;
  }

  let yTicks = $derived.by(() => {
    if (allChartValues.length === 0) return [1, 5, 10];
    const maxRank = Math.max(...allChartValues, 10);
    if (maxRank <= 5) return [1, 3, 5];
    if (maxRank <= 10) return [1, 5, 10];
    if (maxRank <= 15) return [1, 5, 10, 15];
    return [1, 5, 10, 15, 20];
  });

  // Build SVG path for a series of values (skip nulls)
  function buildLinePath(values: (number | null)[]): string {
    let path = '';
    values.forEach((val, i) => {
      if (val == null) return;
      const x = xScale(i) + padding.left;
      const y = yScale(val) + padding.top;
      path += path === '' ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
    return path;
  }

  let overallLinePath = $derived.by(() => {
    if (historyDataPoints.length === 0) return '';
    return buildLinePath(historyDataPoints.map(d => d.value || null));
  });

  let providerLinePaths = $derived.by(() => {
    return providerDataSeries.map(series => ({
      ...series,
      path: buildLinePath(series.points)
    }));
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
    <!-- Header: Title + Query left, Controls right -->
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div class="flex-1">
        <div class="flex items-center gap-3 mb-2">
          <button onclick={goBack} class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" aria-label="Back to measurements">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 class="text-xl font-semibold text-slate-900">{measurement.title}</h1>
        </div>
        <p class="text-sm text-slate-500 ml-8">{measurement.query}</p>
      </div>

      <div class="flex flex-col items-end gap-2 flex-shrink-0">
        <!-- Run Analysis Button -->
        {#if runningAnalysis && (runningAnalysis.status === 'running' || runningAnalysis.status === 'pending' || runningAnalysis.status === 'completed')}
          <!-- Button hidden while analysis is running -->
        {:else}
          <form method="POST" action="?/runAnalysis"
            use:enhance={() => {
              loading = true;
              justStartedAnalysis = true;
              const providerCount = Math.max(1, llmProviders.length);
              runningAnalysis = {
                id: 'temp',
                product_id: product.id,
                status: 'pending',
                total_measurements: 1,
                completed_measurements: 0,
                total_llm_calls: providerCount * 10,
                completed_llm_calls: 0,
                created_at: new Date().toISOString()
              } as any;
              return async ({ result, update }) => {
                loading = false;
                if (result.type === 'success') {
                  await update();
                  startPolling();
                } else {
                  runningAnalysis = null;
                  justStartedAnalysis = false;
                }
              };
            }}
          >
            <Button type="submit" variant="primary" size="md" disabled={loading}>
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 22 22">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Analysis
            </Button>
          </form>
        {/if}

        <!-- LLM Provider Dropdown -->
        <div class="relative">
          <button
            type="button"
            onclick={() => llmDropdownOpen = !llmDropdownOpen}
            class="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-600"
          >
            {#if selectedProvider}
              <LLMLogo provider={selectedProvider.name.includes('openai') ? 'OpenAI' : selectedProvider.name.includes('gemini') || selectedProvider.name.includes('google') ? 'Gemini' : selectedProvider.display_name} size={16} />
              {selectedProvider.display_name}
            {:else}
              All LLMs
            {/if}
            <svg class="w-4 h-4 text-slate-400 transition-transform {llmDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
          </button>

          {#if llmDropdownOpen}
            <!-- Backdrop to close dropdown -->
            <button
              type="button"
              class="fixed inset-0 z-10 cursor-default"
              onclick={() => llmDropdownOpen = false}
              aria-label="Close dropdown"
            ></button>

            <div class="absolute right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
              <button
                type="button"
                onclick={() => { onProviderChange(null); llmDropdownOpen = false; }}
                class="w-full text-left px-3 py-2 text-xs font-medium transition-colors cursor-pointer flex items-center gap-2 {selectedProvider === null ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}"
              >
                All LLMs
              </button>
              {#each llmProviders as provider}
                <button
                  type="button"
                  onclick={() => { onProviderChange(provider); llmDropdownOpen = false; }}
                  class="w-full text-left px-3 py-2 text-xs font-medium transition-colors cursor-pointer flex items-center gap-2 {selectedProvider?.id === provider.id ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}"
                >
                  <LLMLogo provider={provider.name.includes('openai') ? 'OpenAI' : provider.name.includes('gemini') || provider.name.includes('google') ? 'Gemini' : provider.display_name} size={14} />
                  {provider.display_name}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Analysis Running Display -->
    {#if runningAnalysis && (runningAnalysis.status === 'running' || runningAnalysis.status === 'pending')}
      <div class="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div class="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-[rgb(var(--color-primary))] animate-spin flex-shrink-0"></div>
        <div>
          <p class="text-sm font-semibold text-slate-800">Analysis in progress</p>
          <p class="text-sm text-slate-500 mt-0.5">Querying {currentProviderName}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">This may take a few minutes</p>
        </div>
      </div>
    {:else if runningAnalysis && runningAnalysis.status === 'completed'}
      <div class="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5 shadow-sm">
        <div class="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </div>
        <div>
          <p class="text-base font-semibold text-emerald-800">Analysis complete!</p>
          <p class="text-sm text-emerald-600 mt-0.5">Results are ready below</p>
        </div>
      </div>
    {/if}

    <!-- Tabs -->
    <div class="border-b border-slate-200">
      <nav class="flex gap-6">
        <button
          type="button"
          onclick={() => (activeTab = 'results')}
          class="pb-3 text-sm font-medium cursor-pointer transition-colors border-b-2 {activeTab === 'results' ? 'text-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]' : 'text-slate-500 border-transparent hover:text-slate-700'}"
        >Results</button>
        <button
          type="button"
          onclick={() => (activeTab = 'history')}
          class="pb-3 text-sm font-medium cursor-pointer transition-colors border-b-2 {activeTab === 'history' ? 'text-[rgb(var(--color-primary))] border-[rgb(var(--color-primary))]' : 'text-slate-500 border-transparent hover:text-slate-700'}"
        >History</button>
      </nav>
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'results'}
      <!-- Results Tab: Last run data -->
      {#if analysisRuns.length === 0}
        <Card padding="p-12" custom="text-center">
          <div class="mx-auto h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-5">
            <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-800">No analysis runs yet</h3>
          <p class="text-sm text-slate-500 mt-2">Run an analysis to see how your product ranks for this query.</p>
        </Card>
      {:else}
        <!-- Run selector -->
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Run:</span>
          {#each analysisRuns.slice(0, 5) as run (run.id)}
            <button
              type="button"
              onclick={() => selectRun(run.id)}
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer {selectedRunId === run.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}"
            >{formatDateTime(run.created_at)}</button>
          {/each}
        </div>

        <!-- Competitor Rankings -->
        {#if loadingRunData}
          <Card padding="p-12" custom="text-center">
            <div class="flex flex-col items-center gap-3">
              <div class="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-[rgb(var(--color-primary))] animate-spin"></div>
              <p class="text-sm text-slate-500">Loading results…</p>
            </div>
          </Card>
        {:else if competitorRankings.length > 0}
          <CompetitorRankingsTable {competitorRankings} />
        {:else if selectedRunId}
          <Card padding="p-10" custom="text-center">
            <p class="text-sm text-slate-500">
              {selectedProvider ? 'No results for this provider and run.' : 'No competitor results for this run yet.'}
            </p>
          </Card>
        {/if}

        <!-- LLM Breakdown for selected run -->
        {#if !loadingRunData && llmBreakdown.length > 0}
          <Card padding="p-6">
            <h3 class="text-sm font-semibold text-slate-700 mb-4">LLM Breakdown</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Provider</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Avg Rank</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Best</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Worst</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Found</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Success Rate</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {#each llmBreakdown as llm}
                    <tr class="hover:bg-slate-50">
                      <td class="px-4 py-2.5 text-slate-700 font-medium">{llm.provider_name}</td>
                      <td class="px-4 py-2.5">
                        {#if llm.avg_rank != null}
                          <span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full {llm.avg_rank <= 3 ? 'bg-green-100 text-green-800' : llm.avg_rank <= 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">
                            #{llm.avg_rank.toFixed(1)}
                          </span>
                        {:else}
                          <span class="text-slate-400">—</span>
                        {/if}
                      </td>
                      <td class="px-4 py-2.5 text-slate-600">{llm.best_rank != null ? `#${llm.best_rank}` : '—'}</td>
                      <td class="px-4 py-2.5 text-slate-600">{llm.worst_rank != null ? `#${llm.worst_rank}` : '—'}</td>
                      <td class="px-4 py-2.5 text-slate-600">{llm.found_count}/{llm.total_attempts}</td>
                      <td class="px-4 py-2.5">
                        <span class="inline-flex px-2 py-0.5 text-xs font-medium rounded-full {llm.successful === llm.total_attempts ? 'bg-green-50 text-green-700' : llm.failed > llm.successful ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}">
                          {llm.successful}/{llm.total_attempts}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </Card>
        {/if}
      {/if}

    {:else if activeTab === 'history'}
      <!-- History Tab: Average rank over time chart -->
      {#if historyDataPoints.length === 0}
        <Card padding="p-12" custom="text-center">
          <div class="mx-auto h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-5">
            <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-800">No history yet</h3>
          <p class="text-sm text-slate-500 mt-2">Run multiple analyses to see ranking trends over time.</p>
        </Card>
      {:else}
        <Card padding="p-6">
          <h3 class="text-sm font-semibold text-slate-700 mb-4">Average Rank Over Time</h3>
          <p class="text-xs text-slate-500 mb-4">Lower is better. Each point represents the average rank from one analysis run.</p>

          <!-- Legend -->
          <div class="flex flex-wrap items-center gap-4 mb-4">
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-0.5 rounded-full bg-slate-900 inline-block"></span>
              <span class="text-xs text-slate-600 font-medium">Overall</span>
            </div>
            {#each providerLinePaths as series}
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-0.5 rounded-full inline-block" style="background-color: {series.color}"></span>
                <span class="text-xs text-slate-600">{series.name}</span>
              </div>
            {/each}
          </div>

          <div class="w-full overflow-x-auto">
            <svg
              viewBox="0 0 {chartWidth} {chartHeight}"
              class="w-full max-w-2xl mx-auto"
              style="min-width: 400px;"
              aria-label="Ranking history chart"
            >
              <!-- Grid lines -->
              {#each yTicks as tick}
                {@const y = yScale(tick) + padding.top}
                <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#e5e7eb" stroke-width="1" stroke-dasharray="3,3" />
                <text x={padding.left - 8} y={y} text-anchor="end" dominant-baseline="middle" class="text-[10px] fill-gray-400">#{tick}</text>
              {/each}

              <!-- Per-provider lines (drawn first, behind overall) -->
              {#each providerLinePaths as series}
                {#if series.path}
                  <path d={series.path} fill="none" stroke={series.color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4,3" opacity="0.7" />
                {/if}
              {/each}

              <!-- Per-provider data points -->
              {#each providerDataSeries as series, sIdx}
                {#each series.points as val, i}
                  {#if val != null}
                    {@const x = xScale(i) + padding.left}
                    {@const y = yScale(val) + padding.top}
                    <circle cx={x} cy={y} r="3" fill={providerColors[sIdx % providerColors.length]} opacity="0.7" class="cursor-pointer">
                      <title>{series.name}: #{val.toFixed(1)} — {historyDataPoints[i]?.label}</title>
                    </circle>
                  {/if}
                {/each}
              {/each}

              <!-- Overall line (on top) -->
              <path d={overallLinePath} fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

              <!-- Overall data points -->
              {#each historyDataPoints as point, i}
                {@const x = xScale(i) + padding.left}
                {@const y = yScale(point.value) + padding.top}
                <circle cx={x} cy={y} r="4" fill="#0f172a" class="cursor-pointer">
                  <title>{point.tooltip}</title>
                </circle>
              {/each}

              <!-- X-axis labels -->
              {#each historyDataPoints as point, i}
                {#if historyDataPoints.length <= 8 || i === 0 || i === historyDataPoints.length - 1 || i === Math.floor(historyDataPoints.length / 2)}
                  <text
                    x={xScale(i) + padding.left}
                    y={chartHeight - 10}
                    text-anchor="middle"
                    class="text-[9px] fill-gray-400"
                  >{point.label}</text>
                {/if}
              {/each}
            </svg>
          </div>

          <!-- Stats table -->
          {#if rankingHistory.length > 0}
            <div class="mt-6 overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Avg Rank</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Best</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Worst</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Attempts</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {#each rankingHistory as run}
                    <tr class="hover:bg-slate-50">
                      <td class="px-4 py-2.5 text-slate-700">{formatDateTime(run.created_at)}</td>
                      <td class="px-4 py-2.5">
                        {#if run.average_rank != null}
                          <span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full {run.average_rank <= 3 ? 'bg-green-100 text-green-800' : run.average_rank <= 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">
                            #{run.average_rank.toFixed(1)}
                          </span>
                        {:else}
                          <span class="text-slate-400">—</span>
                        {/if}
                      </td>
                      <td class="px-4 py-2.5 text-slate-600">{run.best_rank != null ? `#${run.best_rank}` : '—'}</td>
                      <td class="px-4 py-2.5 text-slate-600">{run.worst_rank != null ? `#${run.worst_rank}` : '—'}</td>
                      <td class="px-4 py-2.5 text-slate-600">{run.successful_attempts}/{run.total_attempts}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </Card>
      {/if}
    {/if}
  </div>
</div>
