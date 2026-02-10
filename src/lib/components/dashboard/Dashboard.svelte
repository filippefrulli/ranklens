<script lang="ts">
  import type { User } from "@supabase/supabase-js";
  import type {
    Company,
    Product,
    LLMProvider,
    QuerySuggestion,
    Measurement,
    MeasurementRankingHistory,
    AnalysisRun,
  } from "../../types";
  import { enhance } from "$app/forms";
  import { invalidate } from "$app/navigation";
  import GoogleBusinessSearch from "../business/GoogleBusinessSearch.svelte";

  import QueryGrid from "./QueryGrid.svelte";
  import BusinessRegistration from "./BusinessRegistration.svelte";
  import AddQueryModal from "./AddQueryModal.svelte";
  import CreateBusinessModal from "./CreateBusinessModal.svelte";
  import AnalysisProgressBar from "./AnalysisProgressBar.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { browser } from "$app/environment";
  import { loadSuggestions, saveSuggestions } from "$lib/utils/suggestionsCache";
  import LLMLogo from '$lib/components/logos/LLMLogo.svelte';

  interface Props {
    form?: any;
    user: User | null;
    company: Company | null;
    activeProduct: Product | null;
    products?: Product[];
    measurements?: Measurement[];
    measurementHistories?: Record<string, MeasurementRankingHistory[]>;
    runningAnalysis?: AnalysisRun | null;
    llmProviders?: LLMProvider[];
    querySuggestions?: string[];
    needsOnboarding?: boolean;
    error?: string | null;
  }

  let {
    form,
    user,
    company,
    activeProduct,
    products = [],
    measurements = [],
    measurementHistories = {},
    runningAnalysis: runningAnalysisProp = null,
    llmProviders = [],
    querySuggestions: serverSuggestions = [],
    needsOnboarding = false,
    error = null,
  }: Props = $props();

  // Convert runningAnalysis to local reactive state for proper UI updates
  let runningAnalysis = $state<AnalysisRun | null>(runningAnalysisProp);
  
  // Track completed analysis IDs to prevent re-syncing them
  let completedAnalysisIds = $state<Set<string>>(new Set());
  
  // Track if we just started an analysis (to prevent premature clearing)
  let justStartedAnalysis = $state(false);

  // Sync local state with prop changes from server invalidation
  $effect(() => {
    if (!runningAnalysisProp) {
      if (justStartedAnalysis) return;
      if (runningAnalysis && runningAnalysis.id !== 'temp') {
        stopProgressTracking();
        if (runningAnalysis.id) completedAnalysisIds.add(runningAnalysis.id);
        setTimeout(() => { runningAnalysis = null; }, 3000);
      }
      return;
    }
    
    if (justStartedAnalysis) justStartedAnalysis = false;
    if (runningAnalysisProp.id && completedAnalysisIds.has(runningAnalysisProp.id)) return;
    
    if (runningAnalysisProp.id && runningAnalysisProp.id !== 'temp') {
      if (runningAnalysisProp.status === 'completed' || runningAnalysisProp.status === 'failed' ||
          (runningAnalysisProp.completed_llm_calls > 0 && 
           runningAnalysisProp.completed_llm_calls >= runningAnalysisProp.total_llm_calls)) {
        runningAnalysis = { ...runningAnalysisProp, status: 'completed' };
        completedAnalysisIds.add(runningAnalysisProp.id);
        stopProgressTracking();
        setTimeout(() => { runningAnalysis = null; }, 3000);
      } else {
        runningAnalysis = runningAnalysisProp;
      }
    }
  });

  // UI state
  let loading = $state(false);
  let selectedProvider = $state<LLMProvider | null>(null);

  // Modal states
  let showCreateBusiness = $state(false);
  let showGoogleSearch = $state(false);
  let showAddQuery = $state(false);
  let showAddProduct = $state(false);
  let isAIGeneratedQuery = $state(false);

  // Query suggestions state
  let querySuggestions = $state<QuerySuggestion[]>(
    serverSuggestions.map((text) => ({ text, reasoning: "" }))
  );
  let loadingSuggestions = $state(false);
  let suggestionError = $state<string | null>(null);

  function setSuggestionsAndCache(texts: string[]) {
    const items = texts.map((text) => ({ text, reasoning: "" }));
    querySuggestions = items;
    if (browser && activeProduct?.id) {
      saveSuggestions(activeProduct.id, items);
    }
  }

  // Static estimated time logic (60s per measurement, no live progress / countdown)
  const SECONDS_PER_MEASUREMENT = 60;
  let estimation = $state<{ totalSeconds: number }>({ totalSeconds: 0 });

  $effect(() => {
    if (runningAnalysis) {
      const totalSeconds = (runningAnalysis.total_measurements || measurements.length) * SECONDS_PER_MEASUREMENT;
      estimation = { totalSeconds };
    } else {
      estimation = { totalSeconds: 0 };
    }
  });

  // Auto-hide analysis indicator
  let hideTimeout: any;
  $effect(() => {
    if (runningAnalysis) {
      if (hideTimeout) clearTimeout(hideTimeout);
      const bufferMs = 15_000;
      const durationMs = estimation.totalSeconds * 1000 + bufferMs;
      hideTimeout = setTimeout(() => {
        if (runningAnalysis && runningAnalysis.status === 'running') {
          runningAnalysis = null;
        }
      }, durationMs);
      return () => hideTimeout && clearTimeout(hideTimeout);
    } else if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
  });

  // Server-side polling
  let pollInterval: any = null;

  function startProgressTracking() {
    if (!browser || !runningAnalysis?.id || runningAnalysis.id === 'temp') return;
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    pollInterval = setInterval(async () => {
      if (!runningAnalysis?.id || runningAnalysis.id === 'temp') return;
      try { await invalidate('app:analysis-status'); } catch (e) {
        console.error('[Dashboard] Failed to invalidate:', e);
      }
    }, 10000);
  }

  function stopProgressTracking() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  $effect(() => {
    if (browser && runningAnalysis && 
        (runningAnalysis.status === 'running' || runningAnalysis.status === 'pending') && 
        runningAnalysis.id && runningAnalysis.id !== 'temp') {
      if (!pollInterval) startProgressTracking();
      return () => { stopProgressTracking(); };
    } else {
      if (runningAnalysis?.id !== 'temp') stopProgressTracking();
    }
  });

  // Form data for new company creation
  let newCompany = $state({
    name: "",
    google_place_id: "",
    city: "",
    google_primary_type: "",
    google_primary_type_display: "",
    google_types: [] as string[],
  });
  let newQuery = $state("");
  let newProductName = $state("");

  // Hydrate suggestions from cache when product changes
  $effect(() => {
    if (!browser || !activeProduct?.id) return;
    const cached = loadSuggestions(activeProduct.id);
    if (cached && cached.length > 0) {
      querySuggestions = cached;
    } else {
      querySuggestions = (serverSuggestions || []).map((t) => ({ text: t, reasoning: "" }));
    }
  });

  $effect(() => {
    if (!browser || !activeProduct?.id) return;
    if (!querySuggestions || querySuggestions.length === 0) return;
    saveSuggestions(activeProduct.id, querySuggestions);
  });

  // Format helper
  function formatDateTime(d: string | Date): string {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  const lastAnalysisText = $derived.by(() => {
    if (runningAnalysis && runningAnalysis.status === 'running') return 'Running…';
    const candidates: number[] = [];
    try {
      for (const list of Object.values(measurementHistories || {})) {
        for (const item of list) {
          if (item?.created_at) {
            const t = new Date(item.created_at).getTime();
            if (!isNaN(t)) candidates.push(t);
          }
        }
      }
    } catch {}
    if (candidates.length === 0) return 'Never';
    return formatDateTime(new Date(Math.max(...candidates)));
  });

  // Event handlers for company/business selection
  function handleBusinessSelected(selectedBusiness: any) {
    newCompany = {
      name: selectedBusiness.name,
      google_place_id: selectedBusiness.google_place_id,
      city: selectedBusiness.city,
      google_primary_type: selectedBusiness.google_primary_type || "",
      google_primary_type_display: selectedBusiness.google_primary_type_display || "",
      google_types: selectedBusiness.google_types || [],
    };
    showGoogleSearch = false;
    showCreateBusiness = true;
  }

  function acceptQuerySuggestion(queryText: string) {
    newQuery = queryText;
    isAIGeneratedQuery = true;
    showAddQuery = true;
  }

  function dismissError() { error = null; }
</script>

{#if user && company && activeProduct}
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <!-- Company + Product Header Card -->
      <div class="grid gap-6 lg:grid-cols-12">
        <div class="lg:col-span-12 space-y-6">
          <Card
            variant="glass"
            padding="p-6"
            custom="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div>
              <h2 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <span class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-black/5 text-black font-bold text-lg"
                  >{activeProduct.name?.[0] || "P"}</span
                >
                {activeProduct.name}
              </h2>
              <p class="text-sm text-gray-600 mt-1 flex items-center gap-2">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  /></svg
                >
                {company.name}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <Button
                variant="primary"
                size="md"
                ariaLabel="Add measurement"
                on:click={() => {
                  isAIGeneratedQuery = false;
                  showAddQuery = true;
                }}>+ Add Measurement</Button
              >
            </div>
          </Card>

          <!-- Metrics Strip -->
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card radius="lg" padding="p-4">
              <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">Measurements</p>
              <p class="mt-2 text-2xl font-semibold text-slate-800">{measurements.length}</p>
            </Card>
            <Card radius="lg" padding="p-4">
              <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">Last Analysis</p>
              <p class="mt-2 text-lg font-semibold text-slate-800">{lastAnalysisText}</p>
            </Card>
            <Card radius="lg" padding="p-4">
              <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">Providers</p>
              <div class="mt-2 flex items-center gap-2 h-8">
                {#if llmProviders && llmProviders.length > 0}
                  {#if llmProviders.some(p => p.name.toLowerCase().includes('openai'))}
                    <LLMLogo provider="OpenAI" size={32} class="h-8 w-8" />
                  {/if}
                  {#if llmProviders.some(p => p.name.toLowerCase().includes('gemini') || p.name.toLowerCase().includes('google'))}
                    <LLMLogo provider="Gemini" size={32} class="h-8 w-8" />
                  {/if}
                  {#if !llmProviders.some(p => p.name.toLowerCase().includes('openai')) && !llmProviders.some(p => p.name.toLowerCase().includes('gemini') || p.name.toLowerCase().includes('google'))}
                    <span class="text-2xl font-semibold text-slate-800">{llmProviders.length}</span>
                  {/if}
                {:else}
                  <span class="text-2xl font-semibold text-slate-800">0</span>
                {/if}
              </div>
            </Card>
          </div>

          <!-- Analysis Controls -->
          {#if runningAnalysis && (runningAnalysis.status === 'running' || runningAnalysis.status === 'pending' || runningAnalysis.status === 'completed')}
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <AnalysisProgressBar 
                estimation={estimation}
                completedCalls={runningAnalysis?.completed_llm_calls || 0}
                totalCalls={runningAnalysis?.total_llm_calls || 0}
              />
            </div>
          {:else}
            <div class="mt-2">
              <Button
                variant="primary"
                ariaLabel="Run analysis"
                disabled={measurements.length === 0}
                on:click={async () => {
                  if (loading || !activeProduct) return;
                  loading = true;
                  justStartedAnalysis = true;
                  
                  const safetyTimeout = setTimeout(() => { justStartedAnalysis = false; }, 30000);
                  
                  try {
                    const providerCount = Math.max(1, llmProviders?.length || 0);
                    const expectedTotalCalls = (measurements?.length || 0) * providerCount * 10;
                    runningAnalysis = {
                      id: 'temp',
                      product_id: activeProduct.id,
                      status: 'pending',
                      total_measurements: measurements.length,
                      completed_measurements: 0,
                      total_llm_calls: expectedTotalCalls,
                      completed_llm_calls: 0,
                      created_at: new Date().toISOString()
                    } as any;

                    const formData = new FormData();
                    formData.set('productId', activeProduct.id);
                    const res = await fetch('?/runAnalysis', { method: 'POST', body: formData });
                    
                    if (!res.ok) {
                      runningAnalysis = null;
                      justStartedAnalysis = false;
                      clearTimeout(safetyTimeout);
                    } else {
                      let analysisRunId: string | null = null;
                      try { 
                        const text = await res.text();
                        const response = JSON.parse(text);
                        if (response.type === 'success' && response.data) {
                          const dataArray = JSON.parse(response.data);
                          if (dataArray && dataArray[2] && typeof dataArray[2] === 'string' && dataArray[2].includes('-')) {
                            analysisRunId = dataArray[2];
                          }
                          if (!analysisRunId && dataArray && dataArray[0] && typeof dataArray[0] === 'object') {
                            analysisRunId = dataArray[0].analysisRunId?.toString();
                          }
                        }
                      } catch (e) {
                        console.error('Failed to parse response:', e);
                      }
                      
                      if (analysisRunId) {
                        runningAnalysis = { ...runningAnalysis, id: analysisRunId } as any;
                        await invalidate('app:analysis-status');
                        startProgressTracking();
                      }
                    }
                  } catch (e) {
                    console.error('Error starting analysis', e);
                    justStartedAnalysis = false;
                    clearTimeout(safetyTimeout);
                  } finally {
                    loading = false;
                  }
                }}
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 22 22">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Analysis
              </Button>
            </div>
          {/if}
        </div>

        <!-- Full Width Tracked Measurements Card -->
        <div class="lg:col-span-12">
          <Card padding="p-0" custom="overflow-hidden">
            <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 bg-slate-50/60">
              <div>
                <h3 class="text-sm font-semibold text-slate-700 tracking-wide">Tracked Measurements</h3>
              </div>
            </div>
            <div class="p-6">
              {#if measurements.length > 0}
                <QueryGrid
                  queries={measurements}
                  analytics={[]}
                  queryHistories={new Map(Object.entries(measurementHistories))}
                  onAddQuery={() => { isAIGeneratedQuery = false; showAddQuery = true; }}
                  onGetAISuggestions={() => {}}
                />
              {:else}
                <div class="text-center py-14">
                  <div class="mx-auto h-12 w-12 rounded-full bg-black/5 flex items-center justify-center mb-5">
                    <svg class="w-6 h-6 text-[rgb(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                  </div>
                  <h4 class="text-base font-semibold text-slate-800">No measurements yet</h4>
                  <p class="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
                    Add the search phrases customers might use. Or let AI suggest relevant queries for you.
                  </p>
                  {#if suggestionError}
                    <div class="mt-5 mb-4 p-3 bg-red-50 border border-red-200 rounded-md max-w-sm mx-auto">
                      <p class="text-red-700 text-xs">{suggestionError}</p>
                    </div>
                  {/if}
                  {#if loadingSuggestions}
                    <div class="mt-6 flex flex-col items-center gap-2">
                      <div class="flex items-center gap-2 text-slate-600 text-sm">
                        <div class="animate-spin rounded-full h-5 w-5 border-2 border-[rgb(var(--color-primary))] border-t-transparent"></div>
                        Generating AI suggestions…
                      </div>
                      <p class="text-[11px] text-slate-500">This may take a few moments</p>
                    </div>
                  {:else if querySuggestions.length > 0}
                    <div class="mt-8 max-w-xl mx-auto space-y-3">
                      {#each querySuggestions as suggestion}
                        <div class="flex items-center gap-3 p-4 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-slate-400 transition-colors w-full md:max-w-xl mx-auto">
                          <div class="text-left flex-1 min-w-0">
                            <p class="text-sm font-medium text-slate-800 break-words">{suggestion.text}</p>
                            {#if suggestion.reasoning}
                              <p class="text-xs text-slate-500 mt-1 leading-relaxed break-words">{suggestion.reasoning}</p>
                            {/if}
                          </div>
                          <button type="button" onclick={() => acceptQuerySuggestion(suggestion.text)}
                            class="shrink-0 inline-flex items-center justify-center h-9 w-9 aspect-square rounded-full bg-[rgb(var(--color-primary))] text-white hover:brightness-95 transition-colors cursor-pointer"
                            aria-label="Add Measurement">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" /></svg>
                          </button>
                        </div>
                      {/each}
                      <div class="flex flex-wrap gap-3 pt-2">
                        <form method="POST" action="?/generateQuerySuggestions"
                          use:enhance={({ formData }) => {
                            loadingSuggestions = true; suggestionError = null;
                            return async ({ result }) => {
                              loadingSuggestions = false;
                              if (result.type === "success" && result.data && "suggestions" in result.data) {
                                const suggestions = (result.data as { suggestions: string[] }).suggestions;
                                querySuggestions = suggestions.map((text: string) => ({ text, reasoning: "" }));
                              } else if (result.type === "failure" && result.data && "error" in result.data) {
                                suggestionError = (result.data as { error: string }).error || "Failed to generate suggestions";
                              } else { suggestionError = "Failed to generate suggestions"; }
                            };
                          }}>
                          <button type="submit" class="text-xs px-3 py-2 rounded-md border border-slate-300 text-slate-600 hover:bg-gray-100 cursor-pointer inline-flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Generate More
                          </button>
                        </form>
                        <button type="button" class="text-xs px-3 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white hover:brightness-95 cursor-pointer inline-flex items-center gap-1"
                          onclick={() => { isAIGeneratedQuery = false; showAddQuery = true; }}>
                          <span>+</span> Add Custom
                        </button>
                      </div>
                    </div>
                  {:else}
                    <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <form method="POST" action="?/generateQuerySuggestions"
                        use:enhance={({ formData }) => {
                          loadingSuggestions = true; suggestionError = null;
                          return async ({ result }) => {
                            loadingSuggestions = false;
                            if (result.type === "success" && result.data && "suggestions" in result.data) {
                              const suggestions = (result.data as { suggestions: string[] }).suggestions;
                              querySuggestions = suggestions.map((text: string) => ({ text, reasoning: "" }));
                            } else if (result.type === "failure" && result.data && "error" in result.data) {
                              suggestionError = (result.data as { error: string }).error || "Failed to generate suggestions";
                            } else { suggestionError = "Failed to generate suggestions"; }
                          };
                        }}>
                        <button type="submit" class="bg-black text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-gray-800 cursor-pointer inline-flex items-center gap-2">
                          <span>✨</span>
                          {loadingSuggestions ? "Generating…" : "Get AI Suggestions"}
                        </button>
                      </form>
                      <button type="button" class="bg-[rgb(var(--color-primary))] text-white px-5 py-2.5 rounded-md text-sm font-medium hover:brightness-95 cursor-pointer inline-flex items-center gap-2"
                        onclick={() => { isAIGeneratedQuery = false; showAddQuery = true; }}>
                        <span>+</span> Add Manually
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </Card>
        </div>

        <!-- AI Suggestions Card (shown when measurements exist) -->
        {#if measurements.length > 0}
          <div class="lg:col-span-12">
            <Card padding="p-6">
              <div class="text-center mb-5">
                <h3 class="text-sm font-semibold text-slate-700 tracking-wide">AI Suggestions</h3>
                <p class="text-xs text-slate-500 mt-1">
                  {#if querySuggestions.length > 0}
                    Click a suggestion to add it to your tracked measurements
                  {:else if loadingSuggestions}
                    Generating suggestions…
                  {:else}
                    Let AI propose new relevant search phrases based on what you already track
                  {/if}
                </p>
              </div>
              <div class="flex justify-center mb-4">
                <form method="POST" action="?/generateQuerySuggestions"
                  use:enhance={() => {
                    loadingSuggestions = true; suggestionError = null;
                    return async ({ result }) => {
                      loadingSuggestions = false;
                      if (result.type === "success" && result.data && "suggestions" in result.data) {
                        const suggestions = (result.data as { suggestions: string[] }).suggestions;
                        querySuggestions = suggestions.map((text: string) => ({ text, reasoning: "" }));
                      } else if (result.type === "failure" && result.data && "error" in result.data) {
                        suggestionError = (result.data as { error: string }).error || "Failed to generate suggestions";
                      } else { suggestionError = "Failed to generate suggestions"; }
                    };
                  }}>
                  <button type="submit" class="px-5 py-2.5 rounded-md text-sm font-medium bg-[rgb(var(--color-secondary))] text-white hover:brightness-90 transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={loadingSuggestions} aria-busy={loadingSuggestions}>
                    <span>✨</span>
                    {#if loadingSuggestions}
                      {querySuggestions.length > 0 ? "Refreshing…" : "Generating…"}
                    {:else}
                      {querySuggestions.length > 0 ? "Refresh Suggestions" : "Generate Suggestions"}
                    {/if}
                  </button>
                </form>
              </div>
              {#if suggestionError}
                <div class="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p class="text-xs text-red-700">{suggestionError}</p>
                </div>
              {/if}
              {#if loadingSuggestions && querySuggestions.length === 0}
                <div class="flex items-center gap-2 text-slate-600 text-sm py-4">
                  <div class="animate-spin rounded-full h-5 w-5 border-2 border-[rgb(var(--color-primary))] border-t-transparent"></div>
                  Generating suggestions…
                </div>
              {:else}
                <div class="space-y-2">
                  {#each querySuggestions as suggestion}
                    <button type="button" class="w-full md:max-w-xl text-left p-3 rounded-md border border-slate-200 hover:border-slate-400 bg-white hover:bg-black/5 transition-colors cursor-pointer group flex items-center gap-3 mx-auto"
                      onclick={() => acceptQuerySuggestion(suggestion.text)}>
                      <span class="flex-1 text-sm text-slate-700 group-hover:text-slate-900 break-words">{suggestion.text}</span>
                      <span class="shrink-0 inline-flex h-9 w-9 aspect-square items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-white">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" /></svg>
                      </span>
                    </button>
                  {/each}
                </div>
              {/if}
            </Card>
          </div>
        {/if}
      </div>
    </main>

    <!-- Error Toast -->
    {#if error}
      <div class="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-md">
        <div class="flex justify-between items-start">
          <p class="text-sm">{error}</p>
          <button type="button" class="ml-2 text-white hover:text-gray-200" onclick={dismissError}>×</button>
        </div>
      </div>
    {/if}

    <!-- Modals -->
    {#if showAddQuery && activeProduct}
      <AddQueryModal
        show={showAddQuery}
        {loading}
        {newQuery}
        productId={activeProduct.id}
        isAIGenerated={isAIGeneratedQuery}
        onClose={() => { showAddQuery = false; isAIGeneratedQuery = false; newQuery = ""; }}
      />
    {/if}
  </div>
{:else if user && (needsOnboarding || !company)}
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <BusinessRegistration onSearchForBusiness={() => (showGoogleSearch = true)} />
    </main>

    {#if showGoogleSearch}
      <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">Find Your Company</h3>
              <button onclick={() => (showGoogleSearch = false)} class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer" aria-label="Close modal">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <GoogleBusinessSearch onBusinessSelected={handleBusinessSelected} />
          </div>
        </div>
      </div>
    {/if}

    {#if showCreateBusiness}
      <CreateBusinessModal
        show={showCreateBusiness}
        {loading}
        business={newCompany}
        onBackToSearch={() => { showCreateBusiness = false; showGoogleSearch = true; }}
      />
    {/if}
  </div>
{:else if user && company && !activeProduct}
  <!-- Company exists but no product yet — prompt to create one -->
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card variant="glass" radius="2xl" padding="p-8">
        <div class="text-center">
          <h2 class="text-2xl font-semibold text-slate-900 mb-3">Add Your First Product</h2>
          <p class="text-sm text-slate-600 mb-8">Create a product to start tracking how it ranks across AI assistants.</p>
          
          <form method="POST" action="?/createProduct"
            use:enhance={() => {
              loading = true;
              return async ({ result, update }) => {
                loading = false;
                if (result.type === 'success') { newProductName = ''; await update(); }
              };
            }}>
            <div class="max-w-md mx-auto space-y-4">
              <input type="text" name="name" bind:value={newProductName} required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50"
                placeholder="e.g. iPhone, Website Builder, Coffee Blend" />
              <textarea name="description" rows="2"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50"
                placeholder="Optional: Brief description to help AI understand your product"></textarea>
              <Button type="submit" variant="primary" size="lg" disabled={loading || !newProductName.trim()}>
                {loading ? 'Creating…' : 'Create Product'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </main>
  </div>
{:else}
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
      <p class="text-gray-600">Please wait while we load your dashboard.</p>
    </div>
  </div>
{/if}
