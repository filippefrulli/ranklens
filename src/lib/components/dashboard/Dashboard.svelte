<script lang="ts">
  import type { User } from '@supabase/supabase-js';
  import type {
    Business,
    LLMProvider,
    WeeklyAnalysisCheck,
    QuerySuggestion,
    Query,
    QueryRankingHistory,
    AnalysisRun
  } from "../../types";
  import GoogleBusinessSearch from "../business/GoogleBusinessSearch.svelte";
  import BusinessNameBar from "./BusinessNameBar.svelte";
  import DashboardControls from "./DashboardControls.svelte";
  import QueryGrid from "./QueryGrid.svelte";
  import BusinessRegistration from "./BusinessRegistration.svelte";
  import AddQueryModal from "./AddQueryModal.svelte";
  import CreateBusinessModal from "./CreateBusinessModal.svelte";
  import AnalysisProgressBar from "./AnalysisProgressBar.svelte";
  import QuerySuggestionsModal from "./QuerySuggestionsModal.svelte";

  interface Props {
    form?: any
    user: User | null
    business: Business | null
    queries?: Query[]
    queryHistories?: Record<string, QueryRankingHistory[]>
    weeklyCheck?: WeeklyAnalysisCheck | null
    runningAnalysis?: AnalysisRun | null
    llmProviders?: LLMProvider[]
    needsOnboarding?: boolean
    error?: string | null
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
    needsOnboarding = false,
    error = null
  }: Props = $props()

  // UI state
  let loading = $state(false);
  let selectedProvider = $state<LLMProvider | null>(null);

  // Modal states
  let showCreateBusiness = $state(false);
  let showGoogleSearch = $state(false);
  let showAddQuery = $state(false);
  let showQuerySuggestions = $state(false);

  // Progress tracking
  let analysisProgress = $state({
    currentStep: 0,
    totalSteps: 0,
    percentage: 0,
    currentQuery: '',
    currentProvider: ''
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
      queryHistories: Object.entries(queryHistories).map(([queryId, history]) => ({
        query_id: queryId,
        history
      }))
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

  // Form submission handlers (these will submit to form actions)
  function handleCreateBusiness(event: Event) {
    // Form submission will be handled by SvelteKit form action
    // The form data is already bound to the form inputs
  }

  function handleAddQuery(event: Event) {
    // Form submission will be handled by SvelteKit form action
    // The form data is already bound to the form inputs
  }

  function handleRunAnalysis(event: Event) {
    // Form submission will be handled by SvelteKit form action
  }

  function handleAcceptQuerySuggestion(queryText: string) {
    newQuery = queryText;
    showQuerySuggestions = false;
    showAddQuery = true;
  }

  // TODO: Convert to server-side function or form action
  async function generateQuerySuggestions(): Promise<QuerySuggestion[]> {
    console.warn('generateQuerySuggestions: Should be moved to server-side');
    return [];
  }

  // Progress monitoring (for real-time updates during analysis)
  function monitorAnalysisProgress() {
    if (!business || !runningAnalysis) return;
    
    const checkInterval = setInterval(async () => {
      try {
        // This should use a server-side API endpoint
        const response = await fetch(`/api/analysis-status?businessId=${business.id}`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'completed') {
            clearInterval(checkInterval);
            // Reload page to get updated data
            window.location.reload();
          } else if (data.status === 'error') {
            clearInterval(checkInterval);
            error = data.error || 'Analysis failed';
          } else {
            analysisProgress = data.progress || analysisProgress;
          }
        }
      } catch (err) {
        console.error('Error monitoring analysis:', err);
        clearInterval(checkInterval);
      }
    }, 2000);

    // Return cleanup function
    return () => clearInterval(checkInterval);
  }

  // Start monitoring if analysis is already running
  $effect(() => {
    if (runningAnalysis) {
      const cleanup = monitorAnalysisProgress();
      return cleanup;
    }
  });

  // Weekly check monitoring
  async function checkWeeklyAnalysis() {
    if (!business) return;
    
    try {
      const response = await fetch(`/api/weekly-check?businessId=${business.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.needsAnalysis) {
          // Reload page to trigger analysis
          window.location.reload();
        }
      }
    } catch (err) {
      console.error('Error checking weekly analysis:', err);
    }
  }

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
        weeklyCheck={weeklyCheck || { canRun: false, lastRunDate: new Date().toISOString() }}
        onAddQuery={() => (showAddQuery = true)}
        onRunAnalysis={() => {
          // This will be handled by a form action
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
        onProviderChange={handleProviderSelection}
      />

      {#if runningAnalysis}
        <AnalysisProgressBar
          progress={analysisProgress}
        />
      {/if}

      {#if filteredDashboardData?.queries && filteredDashboardData.queries.length > 0}
        <QueryGrid
          queries={filteredDashboardData.queries}
          analytics={[]} 
          queryHistories={new Map(Object.entries(queryHistories))}
          onAddQuery={() => (showAddQuery = true)}
          onGetAISuggestions={() => (showQuerySuggestions = true)}
        />
      {:else}
        <div class="text-center py-12">
          <p class="text-gray-500 mb-4">No queries added yet</p>
          <button
            type="button"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            onclick={() => (showAddQuery = true)}
          >
            Add Your First Query
          </button>
        </div>
      {/if}
    </main>

    <!-- Error Toast -->
    {#if error}
      <div class="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-md">
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
        loading={loading}
        newQuery={newQuery}
        onSubmit={() => {
          // Handle form submission via form action
          handleAddQuery(new Event('submit'));
        }}
        onClose={() => (showAddQuery = false)}
      />
    {/if}

    {#if showQuerySuggestions}
      <QuerySuggestionsModal
        show={showQuerySuggestions}
        {business}
        onAcceptQuery={handleAcceptQuerySuggestion}
        onClose={() => (showQuerySuggestions = false)}
        generateSuggestions={generateQuerySuggestions}
      />
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
      <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">Find Your Business</h3>
              <button
                onclick={() => (showGoogleSearch = false)}
                class="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close modal"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <GoogleBusinessSearch
              onBusinessSelected={handleBusinessSelected}
              onCancel={() => (showGoogleSearch = false)}
            />
          </div>
        </div>
      </div>
    {/if}

    {#if showCreateBusiness}
      <CreateBusinessModal
        show={showCreateBusiness}
        loading={loading}
        business={newBusiness}
        onBackToSearch={() => {
          showCreateBusiness = false;
          showGoogleSearch = true;
        }}
      />
    {/if}
  </div>
{:else}
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900 mb-4">Loading...</h1>
      <p class="text-gray-600">Please wait while we load your dashboard.</p>
    </div>
  </div>
{/if}