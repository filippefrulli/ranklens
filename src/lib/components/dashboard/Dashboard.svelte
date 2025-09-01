<script lang="ts">
  import { onMount } from "svelte";
  import { DatabaseService } from "../../services/database-service";
  import { AuthService, user } from "../../services/auth-service";
  import type {
    Business,
    DashboardData,
    LLMProvider,
    WeeklyAnalysisCheck,
    QuerySuggestion,
  } from "../../types";
  import GoogleBusinessSearch from "../business/GoogleBusinessSearch.svelte";
  import DashboardHeader from "./DashboardHeader.svelte";
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
  }

  let { form }: Props = $props()

  let business = $state<Business | null>(null);
  let dashboardData = $state<DashboardData | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let llmProviders = $state<LLMProvider[]>([]);
  let selectedProvider = $state<LLMProvider | null>(null);
  let weeklyCheck = $state<WeeklyAnalysisCheck>({ canRun: true });

  // Create filtered dashboard data based on selected provider
  let filteredDashboardData = $derived.by(() => {
    if (!dashboardData || !selectedProvider) return dashboardData;
    
    // Filter analytics to only show data for the selected provider
    const filteredAnalytics = dashboardData.analytics.map(analytic => {
      // Filter LLM breakdown to only show selected provider
      const filteredBreakdown = analytic.llm_breakdown.filter(
        breakdown => selectedProvider && breakdown.provider_name === selectedProvider.name
      );
      
      // If no data for this provider, return null
      if (filteredBreakdown.length === 0) {
        return {
          ...analytic,
          average_rank: undefined,
          total_mentions: 0,
          llm_breakdown: [],
          competitors_ranked_higher: []
        };
      }
      
      // Calculate aggregated stats for this provider only
      const totalMentions = filteredBreakdown.reduce((sum, b) => sum + b.mention_count, 0);
      const averageRank = filteredBreakdown.length > 0 
        ? filteredBreakdown.reduce((sum, b) => sum + (b.average_rank || 0), 0) / filteredBreakdown.length
        : undefined;
      
      return {
        ...analytic,
        average_rank: averageRank,
        total_mentions: totalMentions,
        llm_breakdown: filteredBreakdown,
        // For now, keep competitors as-is since they're aggregated across providers
        // You might want to filter these too if you have provider-specific competitor data
        competitors_ranked_higher: analytic.competitors_ranked_higher
      };
    });
    
    return {
      ...dashboardData,
      analytics: filteredAnalytics
    };
  });

  // Modal states
  let showCreateBusiness = $state(false);
  let showGoogleSearch = $state(false);
  let showAddQuery = $state(false);
  let showQuerySuggestions = $state(false);
  let runningAnalysis = $state(false);

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

  onMount(async () => {
    if ($user) {
      await loadBusiness();
      await loadLLMProviders();
    }
  });

  async function loadLLMProviders() {
    try {
      llmProviders = await DatabaseService.getLLMProviders();
      // Start with "All Providers" selected (null)
      selectedProvider = null;
    } catch (err) {
      console.error("Failed to load LLM providers:", err);
    }
  }

  async function checkWeeklyAnalysis() {
    if (!business?.id) return;
    
    try {
      weeklyCheck = await DatabaseService.canRunWeeklyAnalysis(business.id);
    } catch (err) {
      console.error('Error checking weekly analysis:', err);
    }
  }

  async function loadBusiness() {
    if (!$user) return;

    try {
      loading = true;
      error = null;
      business = await DatabaseService.getBusiness($user.id);

      // If business exists, load dashboard data and check weekly analysis
      if (business) {
        await loadDashboardData();
        await checkWeeklyAnalysis();
        // Small delay to ensure any analysis that just started is properly saved
        await new Promise(resolve => setTimeout(resolve, 500));
        await checkForRunningAnalysis(); // Check for any running analysis on load
      }
    } catch (err) {
      console.error("Failed to load business:", err);
      error = err instanceof Error ? err.message : "Failed to load business";
    } finally {
      loading = false;
    }
  }

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

  async function createBusiness() {
    if (!$user) return;

    try {
      loading = true;
      error = null;

      const createdBusiness = await DatabaseService.createBusiness({
        ...newBusiness,
        user_id: $user.id,
      });

      business = createdBusiness;
      showCreateBusiness = false;
      newBusiness = {
        name: "",
        google_place_id: "",
        city: "",
        google_primary_type: "",
        google_primary_type_display: "",
        google_types: [],
      };

      // Load dashboard data for the new business
      await loadDashboardData();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create business";
    } finally {
      loading = false;
    }
  }

  async function loadDashboardData() {
    if (!$user) return;

    try {
      loading = true;
      error = null;
      dashboardData = await DatabaseService.getDashboardData($user.id);

      // Set the business from dashboard data
      if (dashboardData?.business) {
        business = dashboardData.business;
        
        // Check for running analysis after loading dashboard data
        await checkForRunningAnalysis();
        
        // Show query suggestions if user has no queries and hasn't seen suggestions yet
        if (dashboardData.queries.length === 0 && !showQuerySuggestions) {
          showQuerySuggestions = true;
        }
      }
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to load business data";
    } finally {
      loading = false;
    }
  }

  async function checkForRunningAnalysis() {
    if (!business?.id) {
      return;
    }

    try {      
      const response = await AuthService.makeAuthenticatedRequest(`/api/analysis-status?businessId=${business.id}`);
      const data = await response.json();
      
      const { runningAnalysis: activeAnalysis } = data;
      
      if (activeAnalysis) {
        runningAnalysis = true;
        
        // Calculate progress based on completed vs total calls
        const completed = activeAnalysis.completed_llm_calls || 0;
        const total = activeAnalysis.total_llm_calls || 1;
        
        analysisProgress = {
          currentStep: completed,
          totalSteps: total,
          percentage: Math.round((completed / total) * 100),
          currentQuery: 'Resuming analysis...',
          currentProvider: 'Checking status...'
        };

        // Start polling for updates
        startAnalysisPolling();
      } else {
        runningAnalysis = false;
      }
    } catch (err) {
      console.error('Error checking for running analysis:', err);
    }
  }

  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  function startAnalysisPolling() {
    if (pollingInterval) return; // Already polling

    pollingInterval = setInterval(async () => {
      if (!business?.id) {
        stopAnalysisPolling();
        return;
      }

      try {
        const response = await AuthService.makeAuthenticatedRequest(`/api/analysis-status?businessId=${business.id}`);
        const { runningAnalysis: currentAnalysis } = await response.json();
        
        if (!currentAnalysis || currentAnalysis.status === 'completed' || currentAnalysis.status === 'failed') {
          // Analysis completed or failed
          runningAnalysis = false;
          stopAnalysisPolling();
          
          // Refresh dashboard data to show new results
          await loadDashboardData();
          await checkWeeklyAnalysis();
        } else {
          // Update progress
          const completed = currentAnalysis.completed_llm_calls || 0;
          const total = currentAnalysis.total_llm_calls || 1;
          
          analysisProgress = {
            currentStep: completed,
            totalSteps: total,
            percentage: Math.round((completed / total) * 100),
            currentQuery: 'Analysis in progress...',
            currentProvider: 'Multiple providers'
          };
        }
      } catch (err) {
        console.error('Error polling analysis status:', err);
        // Don't stop polling on error, continue trying
      }
    }, 3000); // Poll every 3 seconds
  }

  function stopAnalysisPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  // Cleanup polling on component destroy
  $effect(() => {
    return () => {
      stopAnalysisPolling();
    };
  });

  async function addQuery() {
    if (!$user || !newQuery.trim()) return;

    try {
      loading = true;
      error = null;

      // Get business ID from dashboard data or load business
      let businessId = dashboardData?.business?.id;
      if (!businessId) {
        const business = await DatabaseService.getBusiness($user.id);
        if (!business) {
          error = "Please register your business first";
          return;
        }
        businessId = business.id;
      }

      const existingQueries = dashboardData?.queries || [];
      const query = await DatabaseService.createQuery({
        business_id: businessId,
        text: newQuery.trim(),
        order_index: existingQueries.length,
      });

      // Refresh dashboard data
      await loadDashboardData();

      showAddQuery = false;
      newQuery = "";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to add query";
    } finally {
      loading = false;
    }
  }

  async function acceptQuerySuggestion(queryText: string) {
    if (!$user || !queryText.trim()) return;

    try {      
      // Get business ID from dashboard data
      const businessId = dashboardData?.business?.id;
      if (!businessId) {
        error = "Business not found";
        return;
      }

      const existingQueries = dashboardData?.queries || [];
      const query = await DatabaseService.createQuery({
        business_id: businessId,
        text: queryText.trim(),
        order_index: existingQueries.length,
      });
      
      // Refresh dashboard data to show the new query
      await loadDashboardData();
      
    } catch (err) {
      console.error('❌ Error accepting query suggestion:', err);
      error = err instanceof Error ? err.message : "Failed to add suggested query";
    }
  }

  async function generateQuerySuggestions(): Promise<QuerySuggestion[]> {
    if (!business) {
      throw new Error('Business not found')
    }

    // Use a programmatic form submission to call the server action
    const formData = new FormData()
    
    const response = await fetch('/?/generateQuerySuggestions', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log('🔍 CLIENT DEBUG: Full response:', result)
    
    if (result.type === 'success') {
      // The data is being returned as a stringified array, let's parse it
      let suggestions;
      
      if (typeof result.data === 'string') {
        try {
          console.log('🔍 CLIENT DEBUG: Parsing stringified data:', result.data)
          const parsed = JSON.parse(result.data)
          console.log('🔍 CLIENT DEBUG: Parsed array:', parsed)
          
          // Extract only the string values from the parsed array
          suggestions = parsed.filter((item: unknown) => typeof item === 'string' && item.length > 10)
          console.log('🔍 CLIENT DEBUG: Filtered strings:', suggestions)
        } catch (e) {
          console.error('❌ Failed to parse data:', e)
          throw new Error('Invalid response format')
        }
      } else if (result.data?.suggestions) {
        suggestions = result.data.suggestions
      } else if (Array.isArray(result.data)) {
        suggestions = result.data
      }
      
      if (suggestions && Array.isArray(suggestions)) {
        // Convert strings to QuerySuggestion objects
        const formattedSuggestions = suggestions.map(text => ({ text }))
        console.log('🔍 CLIENT DEBUG: Final formatted suggestions:', formattedSuggestions)
        return formattedSuggestions
      }
    }
    
    throw new Error(result.data?.error || 'Failed to generate suggestions')
  }

  async function runAnalysis() {
    if (!dashboardData?.business) {
      console.error("❌ No business found in dashboard data");
      error = "No business found";
      return;
    }

    if (!dashboardData?.queries.length) {
      console.error("❌ No queries found in dashboard data");
      error = "No queries found. Please add some queries first.";
      return;
    }

    // Check if weekly analysis can be run
    if (!weeklyCheck.canRun) {
      const nextDate = weeklyCheck.nextAllowedDate 
        ? new Date(weeklyCheck.nextAllowedDate).toLocaleDateString()
        : 'next week';
      error = `Weekly analysis already completed. Next analysis available: ${nextDate}`;
      return;
    }

    try {
      runningAnalysis = true;
      error = null;

      // Set initial progress state
      analysisProgress = {
        currentStep: 0,
        totalSteps: dashboardData.queries.length * 4 * 5, // Estimate based on 4 providers
        percentage: 0,
        currentQuery: 'Starting analysis...',
        currentProvider: 'Initializing...'
      };

      // Call the server-side analysis endpoint
      const response = await AuthService.makeAuthenticatedRequest('/api/run-analysis', {
        method: 'POST',
        body: JSON.stringify({
          businessId: dashboardData.business.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start analysis');
      }

      // Update progress to show analysis is running
      analysisProgress = {
        ...analysisProgress,
        currentQuery: 'Analysis running on server...',
        currentProvider: 'Multiple providers'
      };

      // Start polling for progress updates
      startAnalysisPolling();

    } catch (err) {
      console.error("❌ Failed to start analysis:", err);
      error = err instanceof Error ? err.message : "Failed to start analysis";
      runningAnalysis = false;
      
      // Reset progress
      analysisProgress = {
        currentStep: 0,
        totalSteps: 0,
        percentage: 0,
        currentQuery: '',
        currentProvider: ''
      };
    }
  }

  async function signOut() {
    await AuthService.signOut();
  }
</script>

<div class="min-h-screen bg-gray-50">
  <DashboardHeader user={$user} onSignOut={signOut} />
  {#if business}
    <BusinessNameBar {business} />
  {/if}

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if !$user}
      <!-- Auth placeholder -->
      <div class="text-center py-12">
        <h2 class="text-xl text-gray-600">Please sign in to continue</h2>
        <p class="text-sm text-gray-500 mt-2">
          Configure your Supabase authentication to get started
        </p>
      </div>
    {:else if !business}
      <BusinessRegistration onSearchForBusiness={() => (showGoogleSearch = true)} />
    {:else}
      <!-- Dashboard -->
      <div class="space-y-6">
    <DashboardControls
      {llmProviders}
      {selectedProvider}
      hasQueries={dashboardData?.queries?.length! > 0}
      {runningAnalysis}
      {weeklyCheck}
      onAddQuery={() => (showAddQuery = true)}
      onRunAnalysis={runAnalysis}
      onProviderChange={(provider) => selectedProvider = provider}
    />
        
        <!-- Analysis Progress Bar -->
        {#if runningAnalysis}
          <AnalysisProgressBar progress={analysisProgress} />
        {/if}

        {#if filteredDashboardData}
          <QueryGrid
            queries={filteredDashboardData.queries}
            analytics={filteredDashboardData.analytics}
            onAddQuery={() => (showAddQuery = true)}
            onGetAISuggestions={() => (showQuerySuggestions = true)}
          />
        {/if}
      </div>
    {/if}
  </div>

  <!-- Modals -->
  <!-- Google Business Search Modal -->
  {#if showGoogleSearch}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Find Your Business
        </h3>
        <GoogleBusinessSearch
          onBusinessSelected={handleBusinessSelected}
          onCancel={() => (showGoogleSearch = false)}
        />
      </div>
    </div>
  {/if}

  <CreateBusinessModal
    show={showCreateBusiness}
    {loading}
    business={newBusiness}
    onSubmit={createBusiness}
    onBackToSearch={() => {
      showCreateBusiness = false;
      showGoogleSearch = true;
    }}
  />

  <AddQueryModal
    show={showAddQuery}
    {loading}
    bind:newQuery
    onSubmit={addQuery}
    onClose={() => (showAddQuery = false)}
  />

  {#if business}
    <QuerySuggestionsModal
      show={showQuerySuggestions}
      {business}
      onAcceptQuery={acceptQuerySuggestion}
      onClose={() => (showQuerySuggestions = false)}
      generateSuggestions={generateQuerySuggestions}
    />
  {/if}    <!-- Error Toast -->
  {#if error}
    <div class="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50">
      <div class="flex items-center justify-between">
        <span>{error}</span>
        <button
          onclick={() => (error = null)}
          class="ml-4 text-red-500 hover:text-red-700 cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  {/if}

  <!-- Loading Overlay -->
  {#if loading}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 shadow-xl">
        <div class="flex items-center space-x-3">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span class="text-gray-700">Loading...</span>
        </div>
      </div>
    </div>
  {/if}
</div>
