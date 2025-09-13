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
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BusinessNameBar {business} />

      <DashboardControls
        {llmProviders}
        {selectedProvider}
        hasQueries={queries.length > 0}
        runningAnalysis={!!runningAnalysis}
        weeklyCheck={weeklyCheck || {
          canRun: false,
          lastRunDate: new Date().toISOString(),
        }}
        onAddQuery={() => {
          isAIGeneratedQuery = false;
          showAddQuery = true;
        }}
        onRunAnalysis={() => {
          // Create and submit form for analysis
          const form = document.createElement("form");
          form.method = "POST";
          form.action = "?/runAnalysis";
          form.style.display = "none";

          const businessIdInput = document.createElement("input");
          businessIdInput.name = "businessId";
          businessIdInput.value = business.id;
          form.appendChild(businessIdInput);

          document.body.appendChild(form);
          form.submit();
        }}
        onProviderChange={handleProviderSelection}
      />

      {#if runningAnalysis}
        <AnalysisProgressBar progress={analysisProgress} />
      {/if}

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
        <div class="text-center py-12">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Let's start by creating the queries you want to track
          </h3>
          {#if suggestionError}
            <div
              class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto"
            >
              <p class="text-red-700 text-sm">{suggestionError}</p>
            </div>
          {/if}

          {#if loadingSuggestions}
            <div class="space-y-4">
              <div class="flex items-center justify-center">
                <div
                  class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                ></div>
                <span class="ml-3 text-gray-600"
                  >Generating AI suggestions...</span
                >
              </div>
              <p class="text-sm mt-4 text-gray-500">
                This may take a few moments
              </p>
            </div>
          {:else if querySuggestions.length > 0}
            <div class="max-w-2xl mx-auto">
              <div class="space-y-3">
                {#each querySuggestions as suggestion, index}
                  <div
                    class="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div class="flex-1 text-left">
                      <p class="font-medium text-gray-900">{suggestion.text}</p>
                      {#if suggestion.reasoning}
                        <p class="text-sm text-gray-600 mt-1">
                          {suggestion.reasoning}
                        </p>
                      {/if}
                    </div>
                    <div class="flex space-x-2 ml-4">
                      <button
                        type="button"
                        onclick={() => acceptQuerySuggestion(suggestion.text)}
                        class="flex items-center justify-center w-8 h-8 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors cursor-pointer"
                        title="Add Query"
                        aria-label="Add Query"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v16m8-8H4"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
              <div class="mt-6 space-x-4">
                <form
                  method="POST"
                  action="?/generateQuerySuggestions"
                  style="display: inline;"
                  use:enhance={({ formData }) => {
                    loadingSuggestions = true;
                    suggestionError = null;

                    return async ({ result, update }) => {
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
                    disabled={loadingSuggestions}
                    class="text-black px-4 py-2 rounded-lg border border-gray-400 disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    {loadingSuggestions ? "Generating..." : "Generate More"}
                  </button>
                </form>
                <button
                  type="button"
                  onclick={() => {
                    isAIGeneratedQuery = false;
                    showAddQuery = true;
                  }}
                  class="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>+</span>
                  Add Custom Query
                </button>
              </div>
            </div>
          {:else}
            <div class="space-y-4">
              <form
                method="POST"
                action="?/generateQuerySuggestions"
                use:enhance={({ formData }) => {
                  loadingSuggestions = true;
                  suggestionError = null;

                  return async ({ result, update }) => {
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
                  disabled={loadingSuggestions}
                  class="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-2"
                >
                  <span>✨</span>
                  {loadingSuggestions ? "Generating..." : "Get AI Suggestions"}
                </button>
              </form>
              <p class="text-sm text-gray-500">Or</p>
              <button
                type="button"
                onclick={() => {
                  isAIGeneratedQuery = false;
                  showAddQuery = true;
                }}
                class="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <span>+</span>
                Add Manually
              </button>
            </div>
          {/if}
        </div>
      {/if}
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
