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
  import BusinessNameBar from "./BusinessNameBar.svelte";
  import DashboardControls from "./DashboardControls.svelte";
  import QueryGrid from "./QueryGrid.svelte";
  import BusinessRegistration from "./BusinessRegistration.svelte";
  import AddQueryModal from "./AddQueryModal.svelte";
  import CreateBusinessModal from "./CreateBusinessModal.svelte";
  import AnalysisProgressBar from "./AnalysisProgressBar.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";

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
    runningAnalysis = null,
    llmProviders = [],
    querySuggestions: serverSuggestions = [],
    needsOnboarding = false,
    error = null,
  }: Props = $props();

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
  let querySuggestions = $state<QuerySuggestion[]>(
    serverSuggestions.map((text) => ({ text, reasoning: "" }))
  );
  let loadingSuggestions = $state(false);
  let suggestionError = $state<string | null>(null);

  // Progress tracking
  let analysisProgress = $state({
    currentStep: 0,
    totalSteps: 0,
    percentage: 0,
    currentQuery: "",
    currentProvider: "",
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

  // Initialize selected provider (start with "All Providers" - null)
  $effect(() => {
    if (llmProviders.length > 0 && selectedProvider === null) {
      selectedProvider = null; // This represents "All Providers"
    }
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

  // Progress monitoring - handled server-side with periodic refresh
  // TODO: Implement server-sent events or WebSocket for real-time updates
  function monitorAnalysisProgress() {
    if (!business || !runningAnalysis) return;

    // Periodically refresh data by reloading the page
    // This ensures we get updated analysis status from server-side load function
    const checkInterval = setInterval(() => {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }

  // Start monitoring if analysis is already running
  $effect(() => {
    if (runningAnalysis) {
      const cleanup = monitorAnalysisProgress();
      return cleanup;
    }
  });

  // UI helper functions
  function dismissError() {
    error = null;
  }

  function handleProviderSelection(provider: LLMProvider | null) {
    selectedProvider = provider;
  }
</script>

{#if user && business}
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <!-- Business Summary / Header Card -->
      <div class="grid gap-6 lg:grid-cols-12">
        <div class="lg:col-span-8 space-y-6">
          <Card variant="glass" padding="p-6" custom="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <span class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 font-bold text-lg">{business.name?.[0] || 'B'}</span>
                {business.name}
              </h2>
              <p class="text-sm text-gray-600 mt-1 flex items-center gap-2">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                {business.city || 'Location N/A'}
                {#if business.google_primary_type_display}
                  <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">{business.google_primary_type_display}</span>
                {/if}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <Button variant="subtle" size="md" ariaLabel="Change business" on:click={() => (showGoogleSearch = true)}>Change</Button>
              <Button variant="primary" size="md" ariaLabel="Add query" on:click={() => { isAIGeneratedQuery = false; showAddQuery = true; }}>Add Query</Button>
            </div>
          </Card>

          <!-- Metrics Strip -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card radius="lg" padding="p-4">
              <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">Avg Rank</p>
              <p class="mt-2 text-2xl font-semibold text-slate-800">—</p>
              <p class="text-[11px] text-slate-500 mt-1">No data yet</p>
            </Card>
            <Card radius="lg" padding="p-4">
              <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">Queries</p>
              <p class="mt-2 text-2xl font-semibold text-slate-800">{queries.length}</p>
              <p class="text-[11px] text-slate-500 mt-1">Tracked now</p>
            </Card>
            <Card radius="lg" padding="p-4">
              <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">Last Analysis</p>
              <p class="mt-2 text-lg font-semibold text-slate-800">{runningAnalysis ? 'Running…' : (weeklyCheck?.lastRunDate ? new Date(weeklyCheck.lastRunDate).toLocaleDateString() : 'Never')}</p>
              <p class="text-[11px] text-slate-500 mt-1">Status</p>
            </Card>
            <Card radius="lg" padding="p-4">
              <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">Providers</p>
              <p class="mt-2 text-2xl font-semibold text-slate-800">{llmProviders.length || 0}</p>
              <p class="text-[11px] text-slate-500 mt-1">Configured</p>
            </Card>
          </div>

          <!-- Queries Section -->
          <!-- Tracked Queries card moved to its own full-width row -->
        </div>

        <!-- Right Sidebar Column -->
        <div class="lg:col-span-4 space-y-6">
          <!-- Run Analysis / Controls Card -->
          <Card padding="p-5">
            <div class="flex items-start justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Analysis</h3>
                <p class="text-xs text-slate-500 mt-1">Run fresh rankings across providers</p>
              </div>
              <div class="flex -space-x-1">
                {#each llmProviders.slice(0,4) as provider}
                  <span class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white bg-gradient-to-br from-slate-200 to-slate-300 text-[11px] font-semibold text-slate-600 shadow ring-1 ring-slate-300" title={provider.name}>{provider.name?.[0] || 'P'}</span>
                {/each}
                {#if llmProviders.length > 4}
                  <span class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white bg-slate-100 text-[11px] font-medium text-slate-600 ring-1 ring-slate-300">+{llmProviders.length - 4}</span>
                {/if}
              </div>
            </div>
            <div class="mt-4 space-y-3">
              <Button variant="primary" fullWidth ariaLabel="Run analysis" disabled={!!runningAnalysis || queries.length === 0} on:click={() => {
                  const form = document.createElement('form');
                  form.method = 'POST';
                  form.action = '?/runAnalysis';
                  form.style.display = 'none';
                  const businessIdInput = document.createElement('input');
                  businessIdInput.name = 'businessId';
                  businessIdInput.value = business.id;
                  form.appendChild(businessIdInput);
                  document.body.appendChild(form);
                  form.submit();
                }}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                {runningAnalysis ? 'Running Analysis…' : 'Run Analysis'}
              </Button>
              <p class="text-[11px] text-slate-500 leading-relaxed">Each run queries all configured LLM providers multiple times per search phrase to build reliable rankings.</p>
              <div class="pt-2 border-t border-slate-100">
                <p class="text-[11px] text-slate-500">Weekly allowance: <span class="font-medium text-slate-700">{weeklyCheck?.canRun ? 'Available' : 'Used'}</span></p>
              </div>
            </div>
          </Card>

          {#if runningAnalysis}
            <Card padding="p-5">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-slate-700">Analysis Progress</h3>
                <span class="text-[11px] text-slate-500">Auto-refreshing</span>
              </div>
              <AnalysisProgressBar progress={analysisProgress} />
            </Card>
          {/if}

        </div>
        <!-- Full Width Tracked Queries Card -->
        <div class="lg:col-span-12">
          <Card padding="p-0" custom="overflow-hidden">
            <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 bg-slate-50/60">
              <div>
                <h3 class="text-sm font-semibold text-slate-700 tracking-wide">Tracked Queries</h3>
                <p class="text-xs text-slate-500 mt-0.5">Monitor how you appear across LLM assistants</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button class="px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors {selectedProvider === null ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}" onclick={() => handleProviderSelection(null)}>All</button>
                {#each llmProviders as provider}
                  <button
                    class="px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors flex items-center gap-1 {selectedProvider?.id === provider.id ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}"
                    onclick={() => handleProviderSelection(provider)}
                    aria-label={`Filter by ${provider.name}`}
                  >
                    <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[10px] font-semibold text-slate-600">{provider.name?.[0] || 'P'}</span>
                    {provider.name}
                  </button>
                {/each}
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
                  <div class="mx-auto h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-5">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
                  </div>
                  <h4 class="text-base font-semibold text-slate-800">No queries yet</h4>
                  <p class="mt-2 text-sm text-slate-500 max-w-sm mx-auto">Add the search phrases customers might use. Or let AI suggest relevant queries for you.</p>
                  {#if suggestionError}
                    <div class="mt-5 mb-4 p-3 bg-red-50 border border-red-200 rounded-md max-w-sm mx-auto">
                      <p class="text-red-700 text-xs">{suggestionError}</p>
                    </div>
                  {/if}
                  {#if loadingSuggestions}
                    <div class="mt-6 flex flex-col items-center gap-2">
                      <div class="flex items-center gap-2 text-slate-600 text-sm">
                        <div class="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                        Generating AI suggestions…
                      </div>
                      <p class="text-[11px] text-slate-500">This may take a few moments</p>
                    </div>
                  {:else if querySuggestions.length > 0}
                    <div class="mt-8 max-w-xl mx-auto space-y-3">
                      {#each querySuggestions as suggestion}
                        <div class="flex items-start justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-blue-300 transition-colors">
                          <div class="text-left">
                            <p class="text-sm font-medium text-slate-800">{suggestion.text}</p>
                            {#if suggestion.reasoning}
                              <p class="text-xs text-slate-500 mt-1 leading-relaxed">{suggestion.reasoning}</p>
                            {/if}
                          </div>
                          <button
                            type="button"
                            onclick={() => acceptQuerySuggestion(suggestion.text)}
                            class="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
                            aria-label="Add Query"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
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
                              if (result.type === 'success' && result.data && 'suggestions' in result.data) {
                                const suggestions = (result.data as { suggestions: string[] }).suggestions;
                                querySuggestions = suggestions.map((text: string) => ({ text, reasoning: '' }));
                              } else if (result.type === 'failure' && result.data && 'error' in result.data) {
                                suggestionError = (result.data as { error: string }).error || 'Failed to generate suggestions';
                              } else {
                                suggestionError = 'Failed to generate suggestions';
                              }
                            };
                          }}
                        >
                          <button type="submit" class="text-xs px-3 py-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer inline-flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                            Generate More
                          </button>
                        </form>
                        <button type="button" class="text-xs px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer inline-flex items-center gap-1" onclick={() => { isAIGeneratedQuery = false; showAddQuery = true; }}>
                          <span>+</span> Add Custom
                        </button>
                      </div>
                    </div>
                  {:else}
                    <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <form
                        method="POST"
                        action="?/generateQuerySuggestions"
                        use:enhance={({ formData }) => {
                          loadingSuggestions = true;
                          suggestionError = null;
                          return async ({ result }) => {
                            loadingSuggestions = false;
                            if (result.type === 'success' && result.data && 'suggestions' in result.data) {
                              const suggestions = (result.data as { suggestions: string[] }).suggestions;
                              querySuggestions = suggestions.map((text: string) => ({ text, reasoning: '' }));
                            } else if (result.type === 'failure' && result.data && 'error' in result.data) {
                              suggestionError = (result.data as { error: string }).error || 'Failed to generate suggestions';
                            } else {
                              suggestionError = 'Failed to generate suggestions';
                            }
                          };
                        }}
                      >
                        <button type="submit" class="bg-gray-900 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-gray-800 cursor-pointer inline-flex items-center gap-2">
                          <span>✨</span> {loadingSuggestions ? 'Generating…' : 'Get AI Suggestions'}
                        </button>
                      </form>
                      <button type="button" class="bg-blue-600 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer inline-flex items-center gap-2" onclick={() => { isAIGeneratedQuery = false; showAddQuery = true; }}>
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
                <h3 class="text-sm font-semibold text-slate-700 tracking-wide">AI Suggestions</h3>
                <p class="text-xs text-slate-500 mt-1">
                  {#if querySuggestions.length > 0}
                    Click a suggestion to add it to your tracked queries
                  {:else if loadingSuggestions}
                    Generating suggestions…
                  {:else}
                    Let AI propose new relevant search phrases based on what you already track
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
                      if (result.type === 'success' && result.data && 'suggestions' in result.data) {
                        const suggestions = (result.data as { suggestions: string[] }).suggestions;
                        querySuggestions = suggestions.map((text: string) => ({ text, reasoning: '' }));
                      } else if (result.type === 'failure' && result.data && 'error' in result.data) {
                        suggestionError = (result.data as { error: string }).error || 'Failed to generate suggestions';
                      } else {
                        suggestionError = 'Failed to generate suggestions';
                      }
                    };
                  }}
                >
                  <button type="submit" class="px-5 py-2.5 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" disabled={loadingSuggestions} aria-busy={loadingSuggestions}>
                    <span>✨</span>
                    {#if loadingSuggestions}
                      {querySuggestions.length > 0 ? 'Refreshing…' : 'Generating…'}
                    {:else}
                      {querySuggestions.length > 0 ? 'Refresh Suggestions' : 'Generate Suggestions'}
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
                  <div class="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  Generating suggestions…
                </div>
              {:else}
                <div class="space-y-2">
                  {#each querySuggestions as suggestion}
                    <button type="button" class="w-full text-left p-3 rounded-md border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50 transition-colors cursor-pointer group flex items-start justify-between gap-3" onclick={() => acceptQuerySuggestion(suggestion.text)}>
                      <span class="text-sm text-slate-700 group-hover:text-slate-900">{suggestion.text}</span>
                      <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-medium group-hover:bg-blue-700">+</span>
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
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
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
    class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center"
  >
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
      <p class="text-gray-600">Please wait while we load your dashboard.</p>
    </div>
  </div>
{/if}
