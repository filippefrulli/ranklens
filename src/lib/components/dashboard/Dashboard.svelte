<script lang="ts">
  import type { User } from "@supabase/supabase-js";
  import type {
    Business,
    LLMProvider,
    WeeklyAnalysisCheck,
    QuerySuggestion,
    Query,
    QueryRankingHistory,
    AnalysisRun,
  } from "../../types";
  import { enhance } from "$app/forms";
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
  import { createBrowserClient } from '@supabase/ssr';
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

  interface Props {
    form?: any;
    user: User | null;
    business: Business | null;
    queries?: Query[];
    queryHistories?: Record<string, QueryRankingHistory[]>;
    weeklyCheck?: WeeklyAnalysisCheck | null;
    runningAnalysis?: AnalysisRun | null;
    llmProviders?: LLMProvider[];
    querySuggestions?: string[];
    needsOnboarding?: boolean;
    error?: string | null;
  }

  let {
    form,
    user,
    business,
    queries = [],
    queryHistories = {},
    weeklyCheck = null,
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

  // Sync local state with prop changes, but be very careful not to overwrite live progress
  $effect(() => {
    // Don't sync if this analysis ID has already been completed
    if (runningAnalysisProp?.id && completedAnalysisIds.has(runningAnalysisProp.id)) {
      console.log('🚫 Ignoring already completed analysis:', runningAnalysisProp.id);
      return;
    }
    
    // Only sync if:
    // 1. We have a real analysis from server (not temp)
    // 2. It's a different analysis ID (new analysis started)
    // 3. We don't have any current analysis or it's not completed/failed
    // 4. Don't overwrite live progress with stale server data
    if (runningAnalysisProp?.id && 
        runningAnalysisProp.id !== 'temp' && 
        runningAnalysisProp.id !== runningAnalysis?.id &&
        (!runningAnalysis || (runningAnalysis.status !== 'completed' && runningAnalysis.status !== 'failed'))) {
      console.log('🔄 Syncing NEW analysis from server:', runningAnalysisProp);
      runningAnalysis = runningAnalysisProp;
    } else if (runningAnalysisProp?.id === runningAnalysis?.id && runningAnalysis?.status === 'completed') {
      console.log('🚫 Skipping sync - local analysis is completed, server data is stale');
    }
  });

  // UI state
  let loading = $state(false);
  let selectedProvider = $state<LLMProvider | null>(null);

  // Modal states
  let showCreateBusiness = $state(false);
  let showGoogleSearch = $state(false);
  let showAddQuery = $state(false);
  let showQuerySuggestions = $state(false);
  let isAIGeneratedQuery = $state(false);

  // Query suggestions state
  // Note: We cache suggestions per-business in localStorage so they persist across reloads.
  let querySuggestions = $state<QuerySuggestion[]>(
    serverSuggestions.map((text) => ({ text, reasoning: "" }))
  );
  let loadingSuggestions = $state(false);
  let suggestionError = $state<string | null>(null);

  // Helper to set suggestions from server responses and immediately update cache
  function setSuggestionsAndCache(texts: string[]) {
    const items = texts.map((text) => ({ text, reasoning: "" }));
    querySuggestions = items;
    if (browser && business?.id) {
      saveSuggestions(business.id, items);
    }
  }

  // Static estimated time logic (60s per query, no live progress / countdown)
  const SECONDS_PER_QUERY = 60;
  let estimation = $state<{ totalSeconds: number }>({ totalSeconds: 0 });

  $effect(() => {
    if (runningAnalysis) {
      const totalSeconds = (runningAnalysis.total_queries || queries.length) * SECONDS_PER_QUERY;
      estimation = { totalSeconds };
    } else {
      estimation = { totalSeconds: 0 };
    }
  });

  // Auto-hide analysis indicator when either:
  // 1. A future server refresh sets status to completed (handled by conditional block), or
  // 2. Local optimistic timer exceeds estimated time + small buffer.
  let hideTimeout: any;
  $effect(() => {
    if (runningAnalysis) {
      // Clear any previous timeout
      if (hideTimeout) clearTimeout(hideTimeout);
      const bufferMs = 15_000; // 15s buffer beyond estimate
      const durationMs = estimation.totalSeconds * 1000 + bufferMs;
      hideTimeout = setTimeout(() => {
        // If still marked running (optimistic) after estimate + buffer, hide it
        if (runningAnalysis && runningAnalysis.status === 'running') {
          runningAnalysis = null;
        }
      }, durationMs);
      return () => hideTimeout && clearTimeout(hideTimeout);
    } else if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
  });

  // Server-side polling approach - hit our API endpoint every 5 seconds
  let pollInterval: any = null;

  function startProgressTracking() {
    if (!browser || !runningAnalysis?.id || runningAnalysis.id === 'temp') return;

    console.log('🔄 Starting server-side progress tracking for analysis:', runningAnalysis.id);
    
    // Clear any existing polling
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    // Poll every 5 seconds using our server API
    pollInterval = setInterval(async () => {
      if (!runningAnalysis?.id || runningAnalysis.id === 'temp') return;
      
      try {
        // Fetch from our server API with cache busting
        const response = await fetch(`/api/analysis-status/${runningAnalysis.id}?t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          console.error('❌ Server API error:', response.status, response.statusText);
          return;
        }
        
        const data = await response.json();
        
        if (data.error) {
          console.error('❌ API returned error:', data.error);
          return;
        }
        
        console.log('📊 Server progress update:', {
          completed: data.completed_llm_calls,
          total: data.total_llm_calls,
          status: data.status
        });
        
        // Update the state
        runningAnalysis = { ...runningAnalysis, ...data } as any;
        
        // Stop polling when complete
        if (data.status === 'completed' || data.status === 'failed' || 
            (data.completed_llm_calls > 0 && data.completed_llm_calls >= data.total_llm_calls)) {
          console.log('✅ Analysis completed, stopping server polling and marking as done');
          
          // Update state to completed BEFORE stopping to prevent restart
          runningAnalysis = { ...runningAnalysis, ...data, status: 'completed' } as any;
          
          // Mark this analysis ID as completed to prevent future re-syncing
          if (runningAnalysis?.id) {
            completedAnalysisIds.add(runningAnalysis.id);
            console.log('📝 Marked analysis as completed:', runningAnalysis.id);
          }
          
          stopProgressTracking();
          
          // Keep the progress bar visible for 3 seconds then hide it
          setTimeout(() => {
            console.log('🚫 Hiding completed progress bar for:', runningAnalysis?.id);
            runningAnalysis = null;
          }, 3000);
        }
        
      } catch (e) {
        console.error('❌ Server polling exception:', e);
      }
    }, 5000);
  }

  function stopProgressTracking() {
    if (pollInterval) {
      console.log('🛑 Stopping progress tracking');
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  $effect(() => {
    // Start polling when we have a real analysis ID (not temp) and it's not already completed
    if (browser && runningAnalysis && 
        (runningAnalysis.status === 'running' || runningAnalysis.status === 'pending') && 
        runningAnalysis.id && runningAnalysis.id !== 'temp') {
      console.log('🎯 Effect triggering polling for status:', runningAnalysis.status);
      startProgressTracking();
      return () => stopProgressTracking();
    } else {
      if (runningAnalysis?.status === 'completed' || runningAnalysis?.status === 'failed') {
        console.log('🛑 Effect NOT starting polling - analysis is', runningAnalysis.status);
      }
      stopProgressTracking();
    }
  });

  // Form data
  let newBusiness = $state({
    name: "",
    google_place_id: "",
    city: "",
    google_primary_type: "",
    google_primary_type_display: "",
    google_types: [],
  });
  let newQuery = $state("");

  // Create dashboard data from server props
  let dashboardData = $derived.by(() => {
    if (!business || !queries) return null;

    return {
      business,
      queries,
      analytics: [], // TODO: Load analytics from server
      queryHistories: Object.entries(queryHistories).map(
        ([queryId, history]) => ({
          query_id: queryId,
          history,
        })
      ),
    };
  });

  // Create filtered dashboard data based on selected provider
  let filteredDashboardData = $derived.by(() => {
    if (!dashboardData || !selectedProvider) return dashboardData;

    // For now, return unfiltered data since analytics are empty
    // This will be properly implemented when analytics are loaded from server
    return dashboardData;
  });
  // Hydrate suggestions from cache when business changes or on mount
  $effect(() => {
    if (!browser || !business?.id) return;
    const cached = loadSuggestions(business.id);
    if (cached && cached.length > 0) {
      querySuggestions = cached;
    } else {
      // fall back to any server-provided suggestions
      querySuggestions = (serverSuggestions || []).map((t) => ({ text: t, reasoning: "" }));
    }
  });

  // Persist to cache whenever suggestions change and we have a business id
  $effect(() => {
    if (!browser || !business?.id) return;
    if (!querySuggestions || querySuggestions.length === 0) return;
    saveSuggestions(business.id, querySuggestions);
  });

  // Initialize selected provider (start with "All Providers" - null)
  $effect(() => {
    if (llmProviders.length > 0 && selectedProvider === null) {
      selectedProvider = null; // This represents "All Providers"
    }
  });

  // Format helper for human-friendly datetime
  function formatDateTime(d: string | Date): string {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Derive the most recent analysis run date across available sources
  const lastAnalysisText = $derived.by(() => {
    if (runningAnalysis && runningAnalysis.status === 'running') return 'Running…';

    const candidates: number[] = [];
    if (weeklyCheck?.lastRunDate) candidates.push(new Date(weeklyCheck.lastRunDate).getTime());
    if (weeklyCheck?.currentWeekRun?.run_date) candidates.push(new Date(weeklyCheck.currentWeekRun.run_date).getTime());
    if (weeklyCheck?.currentWeekRun?.completed_at) candidates.push(new Date(weeklyCheck.currentWeekRun.completed_at).getTime());

    // Also look through queryHistories to find the max run_date
    try {
      for (const list of Object.values(queryHistories || {})) {
        for (const item of list) {
          if (item?.run_date) {
            const t = new Date(item.run_date).getTime();
            if (!isNaN(t)) candidates.push(t);
          }
        }
      }
    } catch {}

    if (candidates.length === 0) return 'Never';
    const maxTs = Math.max(...candidates);
    return formatDateTime(new Date(maxTs));
  });

  // Event handlers for business selection
  function handleBusinessSelected(selectedBusiness: any) {
    newBusiness = {
      name: selectedBusiness.name,
      google_place_id: selectedBusiness.google_place_id,
      city: selectedBusiness.city,
      google_primary_type: selectedBusiness.google_primary_type || "",
      google_primary_type_display:
        selectedBusiness.google_primary_type_display || "",
      google_types: selectedBusiness.google_types || [],
    };
    showGoogleSearch = false;
    showCreateBusiness = true;
  }

  // Query suggestions handlers
  function acceptQuerySuggestion(queryText: string) {
    newQuery = queryText;
    isAIGeneratedQuery = true;
    showAddQuery = true;
  }

  // Removed auto-reload logic; page stays in place during analysis.

  // UI helper functions
  function dismissError() {
    error = null;
  }

  function handleProviderSelection(provider: LLMProvider | null) {
    selectedProvider = provider;
  }
</script>

{#if user && business}
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <!-- Business Summary / Header Card -->
      <div class="grid gap-6 lg:grid-cols-12">
        <div class="lg:col-span-12 space-y-6">
          <Card
            variant="glass"
            padding="p-6"
            custom="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div>
              <h2
                class="text-xl font-semibold text-gray-900 flex items-center gap-2"
              >
                <span
                  class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-black/5 text-black font-bold text-lg"
                  >{business.name?.[0] || "B"}</span
                >
                {business.name}
              </h2>
              <p class="text-sm text-gray-600 mt-1 flex items-center gap-2">
                <svg
                  class="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  /><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  /></svg
                >
                {business.city || "Location N/A"}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <Button
                variant="primary"
                size="md"
                ariaLabel="Add query"
                on:click={() => {
                  isAIGeneratedQuery = false;
                  showAddQuery = true;
                }}>+ Add Query</Button
              >
            </div>
          </Card>

          <!-- Metrics Strip -->
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card radius="lg" padding="p-4">
              <p
                class="text-xs uppercase tracking-wide text-slate-500 font-medium"
              >
                Queries
              </p>
              <p class="mt-2 text-2xl font-semibold text-slate-800">
                {queries.length}
              </p>
            </Card>
            <Card radius="lg" padding="p-4">
              <p
                class="text-xs uppercase tracking-wide text-slate-500 font-medium"
              >
                Last Analysis
              </p>
              <p class="mt-2 text-lg font-semibold text-slate-800">
                {lastAnalysisText}
              </p>
            </Card>

            <Card radius="lg" padding="p-4">
              <p
                class="text-xs uppercase tracking-wide text-slate-500 font-medium"
              >
                Providers
              </p>
              <div class="mt-2 flex items-center gap-2 h-8">
                {#if llmProviders && llmProviders.length > 0}
                  <!-- Show OpenAI and Gemini logos if those providers exist -->
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

          <!-- Queries Section -->
          <!-- Tracked Queries card moved to its own full-width row -->
          <!-- Analysis Controls: compact button when idle, expanded card when running -->
          {#if runningAnalysis && (runningAnalysis.status === 'running' || runningAnalysis.status === 'pending')}
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <AnalysisProgressBar 
                estimation={estimation}
                completedCalls={runningAnalysis?.completed_llm_calls || 0}
                totalCalls={runningAnalysis?.total_llm_calls || 0}
              />
              <div class="flex -space-x-1">
                {#if llmProviders.length > 4}
                  <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-100 text-[10px] font-medium text-slate-600 ring-1 ring-slate-300">+{llmProviders.length - 4}</span>
                {/if}
              </div>
            </div>
          {:else}
            <div class="mt-2">
              <Button
                variant="primary"
                ariaLabel="Run analysis"
                disabled={queries.length === 0 || !weeklyCheck?.canRun}
                on:click={async () => {
                  // Submit via fetch to avoid full page reload; optimistic UI start
                  if (loading) return;
                  loading = true;
                  try {
                    // Immediately show a local placeholder so the UI switches to a 0% bar
                    console.log('🚀 Starting analysis...');
                    const providerCount = Math.max(1, llmProviders?.length || 0);
                    const expectedTotalCalls = (queries?.length || 0) * providerCount * 5;
                    runningAnalysis = {
                      id: 'temp',
                      business_id: business.id,
                      run_date: new Date().toISOString(),
                      status: 'pending',
                      total_queries: queries.length,
                      completed_queries: 0,
                      total_llm_calls: expectedTotalCalls,
                      completed_llm_calls: 0,
                      created_at: new Date().toISOString()
                    } as any;
                    console.log('✨ Set optimistic runningAnalysis:', runningAnalysis);

                    const formData = new FormData();
                    formData.set('businessId', business.id);
                    const res = await fetch('?/runAnalysis', { method: 'POST', body: formData });
                    if (!res.ok) {
                      console.error('Failed to start analysis');
                      // Revert the optimistic placeholder on failure
                      runningAnalysis = null;
                    } else {
                      // Try to parse the returned id
                      let payload: any = null;
                      try { payload = await res.json(); } catch {}
                      const analysisRunId = payload?.analysisRunId;
                      if (analysisRunId) {
                        console.log('🆔 Got real analysis ID:', analysisRunId);
                        // Replace temp with real id
                        runningAnalysis = { ...runningAnalysis, id: analysisRunId } as any;
                        
                        // Fetch the initial state from our server API
                        try {
                          const response = await fetch(`/api/analysis-status/${analysisRunId}?t=${Date.now()}`);
                          if (response.ok) {
                            const data = await response.json();
                            if (!data.error) {
                              console.log('💾 Initial server analysis state:', data);
                              runningAnalysis = { ...runningAnalysis, ...data } as any;
                            }
                          }
                        } catch (e) {
                          console.warn('Unable to prefetch analysis_runs row:', e);
                        }
                      }
                    }
                  } catch (e) {
                    console.error('Error starting analysis', e);
                  } finally {
                    loading = false;
                  }
                }}
              >
                <svg
                  class="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 22 22"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  /><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  /></svg
                >
                Run Analysis
              </Button>
            </div>
          {/if}
        </div>
        <!-- Full Width Tracked Queries Card -->
        <div class="lg:col-span-12">
          <Card padding="p-0" custom="overflow-hidden">
            <div
              class="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 bg-slate-50/60"
            >
              <div>
                <h3 class="text-sm font-semibold text-slate-700 tracking-wide">
                  Tracked Queries
                </h3>
              </div>

            </div>
            <div class="p-6">
              {#if filteredDashboardData?.queries && filteredDashboardData.queries.length > 0}
                <QueryGrid
                  queries={filteredDashboardData.queries}
                  analytics={[]}
                  queryHistories={new Map(Object.entries(queryHistories))}
                  onAddQuery={() => {
                    isAIGeneratedQuery = false;
                    showAddQuery = true;
                  }}
                  onGetAISuggestions={() => (showQuerySuggestions = true)}
                />
              {:else}
                <div class="text-center py-14">
                  <div
                    class="mx-auto h-12 w-12 rounded-full bg-black/5 flex items-center justify-center mb-5"
                  >
                    <svg
                      class="w-6 h-6 text-[rgb(var(--color-primary))]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                      /></svg
                    >
                  </div>
                  <h4 class="text-base font-semibold text-slate-800">
                    No queries yet
                  </h4>
                  <p class="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
                    Add the search phrases customers might use. Or let AI
                    suggest relevant queries for you.
                  </p>
                  {#if suggestionError}
                    <div
                      class="mt-5 mb-4 p-3 bg-red-50 border border-red-200 rounded-md max-w-sm mx-auto"
                    >
                      <p class="text-red-700 text-xs">{suggestionError}</p>
                    </div>
                  {/if}
                  {#if loadingSuggestions}
                    <div class="mt-6 flex flex-col items-center gap-2">
                      <div
                        class="flex items-center gap-2 text-slate-600 text-sm"
                      >
                        <div
                          class="animate-spin rounded-full h-5 w-5 border-2 border-[rgb(var(--color-primary))] border-t-transparent"
                        ></div>
                        Generating AI suggestions…
                      </div>
                      <p class="text-[11px] text-slate-500">
                        This may take a few moments
                      </p>
                    </div>
                  {:else if querySuggestions.length > 0}
                    <div class="mt-8 max-w-xl mx-auto space-y-3">
                      {#each querySuggestions as suggestion}
                        <div class="flex items-center gap-3 p-4 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-slate-400 transition-colors w-full md:max-w-xl mx-auto">
                          <div class="text-left flex-1 min-w-0">
                            <p class="text-sm font-medium text-slate-800 break-words">
                              {suggestion.text}
                            </p>
                            {#if suggestion.reasoning}
                              <p class="text-xs text-slate-500 mt-1 leading-relaxed break-words">
                                {suggestion.reasoning}
                              </p>
                            {/if}
                          </div>
                          <button
                            type="button"
                            onclick={() => acceptQuerySuggestion(suggestion.text)}
                            class="shrink-0 inline-flex items-center justify-center h-9 w-9 aspect-square rounded-full bg-[rgb(var(--color-primary))] text-white hover:brightness-95 transition-colors cursor-pointer"
                            aria-label="Add Query"
                          >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" /></svg>
                          </button>
                        </div>
                      {/each}
                      <div class="flex flex-wrap gap-3 pt-2">
                        <form
                          method="POST"
                          action="?/generateQuerySuggestions"
                          use:enhance={({ formData }) => {
                            loadingSuggestions = true;
                            suggestionError = null;
                            return async ({ result }) => {
                              loadingSuggestions = false;
                              if (
                                result.type === "success" &&
                                result.data &&
                                "suggestions" in result.data
                              ) {
                                const suggestions = (
                                  result.data as { suggestions: string[] }
                                ).suggestions;
                                querySuggestions = suggestions.map(
                                  (text: string) => ({ text, reasoning: "" })
                                );
                              } else if (
                                result.type === "failure" &&
                                result.data &&
                                "error" in result.data
                              ) {
                                suggestionError =
                                  (result.data as { error: string }).error ||
                                  "Failed to generate suggestions";
                              } else {
                                suggestionError =
                                  "Failed to generate suggestions";
                              }
                            };
                          }}
                        >
                          <button
                            type="submit"
                            class="text-xs px-3 py-2 rounded-md border border-slate-300 text-slate-600 hover:bg-gray-100 cursor-pointer inline-flex items-center gap-1"
                          >
                            <svg
                              class="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              ><path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              /></svg
                            >
                            Generate More
                          </button>
                        </form>
                        <button
                          type="button"
                          class="text-xs px-3 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white hover:brightness-95 cursor-pointer inline-flex items-center gap-1"
                          onclick={() => {
                            isAIGeneratedQuery = false;
                            showAddQuery = true;
                          }}
                        >
                          <span>+</span> Add Custom
                        </button>
                      </div>
                    </div>
                  {:else}
                    <div
                      class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
                    >
                      <form
                        method="POST"
                        action="?/generateQuerySuggestions"
                        use:enhance={({ formData }) => {
                          loadingSuggestions = true;
                          suggestionError = null;
                          return async ({ result }) => {
                            loadingSuggestions = false;
                            if (
                              result.type === "success" &&
                              result.data &&
                              "suggestions" in result.data
                            ) {
                              const suggestions = (
                                result.data as { suggestions: string[] }
                              ).suggestions;
                              querySuggestions = suggestions.map(
                                (text: string) => ({ text, reasoning: "" })
                              );
                            } else if (
                              result.type === "failure" &&
                              result.data &&
                              "error" in result.data
                            ) {
                              suggestionError =
                                (result.data as { error: string }).error ||
                                "Failed to generate suggestions";
                            } else {
                              suggestionError =
                                "Failed to generate suggestions";
                            }
                          };
                        }}
                      >
                        <button
                          type="submit"
                          class="bg-black text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-gray-800 cursor-pointer inline-flex items-center gap-2"
                        >
                          <span>✨</span>
                          {loadingSuggestions
                            ? "Generating…"
                            : "Get AI Suggestions"}
                        </button>
                      </form>
                      <button
                        type="button"
                        class="bg-[rgb(var(--color-primary))] text-white px-5 py-2.5 rounded-md text-sm font-medium hover:brightness-95 cursor-pointer inline-flex items-center gap-2"
                        onclick={() => {
                          isAIGeneratedQuery = false;
                          showAddQuery = true;
                        }}
                      >
                        <span>+</span> Add Manually
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </Card>
        </div>
        <!-- Full Width AI Suggestions Card Moved Below Tracked Queries -->
        {#if filteredDashboardData?.queries?.length}
          <div class="lg:col-span-12">
            <Card padding="p-6">
              <div class="text-center mb-5">
                <h3 class="text-sm font-semibold text-slate-700 tracking-wide">
                  AI Suggestions
                </h3>
                <p class="text-xs text-slate-500 mt-1">
                  {#if querySuggestions.length > 0}
                    Click a suggestion to add it to your tracked queries
                  {:else if loadingSuggestions}
                    Generating suggestions…
                  {:else}
                    Let AI propose new relevant search phrases based on what you
                    already track
                  {/if}
                </p>
              </div>
              <div class="flex justify-center mb-4">
                <form
                  method="POST"
                  action="?/generateQuerySuggestions"
                  use:enhance={() => {
                    loadingSuggestions = true;
                    suggestionError = null;
                    return async ({ result }) => {
                      loadingSuggestions = false;
                      if (
                        result.type === "success" &&
                        result.data &&
                        "suggestions" in result.data
                      ) {
                        const suggestions = (
                          result.data as { suggestions: string[] }
                        ).suggestions;
                        querySuggestions = suggestions.map((text: string) => ({
                          text,
                          reasoning: "",
                        }));
                      } else if (
                        result.type === "failure" &&
                        result.data &&
                        "error" in result.data
                      ) {
                        suggestionError =
                          (result.data as { error: string }).error ||
                          "Failed to generate suggestions";
                      } else {
                        suggestionError = "Failed to generate suggestions";
                      }
                    };
                  }}
                >
                  <button
                    type="submit"
                    class="px-5 py-2.5 rounded-md text-sm font-medium bg-[rgb(var(--color-secondary))] text-white hover:brightness-90 transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={loadingSuggestions}
                    aria-busy={loadingSuggestions}
                  >
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
                <div
                  class="mb-3 p-3 bg-red-50 border border-red-200 rounded-md"
                >
                  <p class="text-xs text-red-700">{suggestionError}</p>
                </div>
              {/if}
              {#if loadingSuggestions && querySuggestions.length === 0}
                <div
                  class="flex items-center gap-2 text-slate-600 text-sm py-4"
                >
                  <div
                    class="animate-spin rounded-full h-5 w-5 border-2 border-[rgb(var(--color-primary))] border-t-transparent"
                  ></div>
                  Generating suggestions…
                </div>
              {:else}
                <div class="space-y-2">
                  {#each querySuggestions as suggestion}
                    <button
                      type="button"
                      class="w-full md:max-w-xl text-left p-3 rounded-md border border-slate-200 hover:border-slate-400 bg-white hover:bg-black/5 transition-colors cursor-pointer group flex items-center gap-3 mx-auto"
                      onclick={() => acceptQuerySuggestion(suggestion.text)}
                    >
                      <span class="flex-1 text-sm text-slate-700 group-hover:text-slate-900 break-words">{suggestion.text}</span>
                      <span class="shrink-0 inline-flex h-9 w-9 aspect-square items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-white group-hover:bg-[rgb(var(--color-primary))]">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" /></svg>
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
      <div
        class="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-md"
      >
        <div class="flex justify-between items-start">
          <p class="text-sm">{error}</p>
          <button
            type="button"
            class="ml-2 text-white hover:text-gray-200"
            onclick={dismissError}
          >
            ×
          </button>
        </div>
      </div>
    {/if}

    <!-- Modals -->
    {#if showAddQuery}
      <AddQueryModal
        show={showAddQuery}
        {loading}
        {newQuery}
        isAIGenerated={isAIGeneratedQuery}
        onClose={() => {
          showAddQuery = false;
          isAIGeneratedQuery = false;
          newQuery = "";
        }}
      />
    {/if}

    {#if showQuerySuggestions}
      <!-- QuerySuggestionsModal is deprecated - using inline suggestions now -->
    {/if}
  </div>
{:else if user && needsOnboarding}
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <BusinessRegistration
        onSearchForBusiness={() => (showGoogleSearch = true)}
      />
    </main>

    <!-- Modals for onboarding -->
    {#if showGoogleSearch}
      <div
        class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
      >
        <div
          class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        >
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">
                Find Your Business
              </h3>
              <button
                onclick={() => (showGoogleSearch = false)}
                class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg
                  class="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
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
        business={newBusiness}
        onBackToSearch={() => {
          showCreateBusiness = false;
          showGoogleSearch = true;
        }}
      />
    {/if}
  </div>
{:else}
  <div
    class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center"
  >
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
      <p class="text-gray-600">Please wait while we load your dashboard.</p>
    </div>
  </div>
{/if}
