<script lang="ts">
  import { onMount } from "svelte";
  import { DatabaseService } from "../../services/database-service";
  import { LLMService } from "../../services/llm-service";
  import { AuthService, user } from "../../services/auth-service";
  import type {
    Business,
    DashboardData,
    LLMProvider,
    WeeklyAnalysisCheck,
  } from "../../types";
  import GoogleBusinessSearch from "../business/GoogleBusinessSearch.svelte";
  import DashboardHeader from "./DashboardHeader.svelte";
  import BusinessNameBar from "./BusinessNameBar.svelte";
  import DashboardControls from "./DashboardControls.svelte";
  import QueryGrid from "./QueryGrid.svelte";
  import BusinessRegistration from "./BusinessRegistration.svelte";
  import AddQueryModal from "./AddQueryModal.svelte";
  import CreateBusinessModal from "./CreateBusinessModal.svelte";
  import WeeklyAnalysisHistory from "./WeeklyAnalysisHistory.svelte";
  import AnalysisProgressBar from "./AnalysisProgressBar.svelte";
  import QuerySuggestionsModal from "./QuerySuggestionsModal.svelte";

  let business = $state<Business | null>(null);
  let dashboardData = $state<DashboardData | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let llmProviders = $state<LLMProvider[]>([]);
  let selectedProvider = $state<LLMProvider | null>(null);
  let weeklyCheck = $state<WeeklyAnalysisCheck>({ canRun: true });

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
      if (llmProviders.length > 0) {
        selectedProvider = llmProviders[0];
      }
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
      console.log('🤖 Accepting query suggestion:', queryText);
      
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

      console.log('✅ Query suggestion accepted and saved:', query);
      
      // Refresh dashboard data to show the new query
      await loadDashboardData();
      
    } catch (err) {
      console.error('❌ Error accepting query suggestion:', err);
      error = err instanceof Error ? err.message : "Failed to add suggested query";
    }
  }

  async function runAnalysis() {
    console.log("🚀 Starting weekly analysis...");
    console.log("Dashboard data:", dashboardData);

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

    let analysisRun: any = null;

    try {
      runningAnalysis = true;
      error = null;

      const providers = await DatabaseService.getLLMProviders();
      const activeProviders = providers.filter((p) => p.is_active);

      if (activeProviders.length === 0) {
        throw new Error("No active LLM providers found");
      }

      // Calculate total steps for progress tracking
      const totalApiCalls = dashboardData.queries.length * activeProviders.length * 5; // 5 attempts per provider per query
      analysisProgress = {
        currentStep: 0,
        totalSteps: totalApiCalls,
        percentage: 0,
        currentQuery: '',
        currentProvider: ''
      };

      console.log(`📊 Initialized progress: ${analysisProgress.currentStep}/${analysisProgress.totalSteps} (${analysisProgress.percentage}%)`);

      // Log provider status for debugging
      console.log(`🔧 Active providers: ${activeProviders.map(p => p.name).join(', ')}`);

      // Small delay to ensure progress bar is visible before starting
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create an analysis run for this week
      analysisRun = await DatabaseService.createAnalysisRun(
        dashboardData.business.id,
        dashboardData.queries.length
      );

      console.log("📊 Created analysis run:", analysisRun.id);

      // Update analysis run status to running
      await DatabaseService.updateAnalysisRun(analysisRun.id, {
        status: 'running',
        started_at: new Date().toISOString()
      });

      for (let i = 0; i < dashboardData.queries.length; i++) {
        const query = dashboardData.queries[i];
        console.log(`📝 Processing query ${i + 1}/${dashboardData.queries.length}: ${query.text}`);

        // Update progress for current query
        analysisProgress = {
          ...analysisProgress,
          currentQuery: query.text,
          currentProvider: 'Starting...'
        };

        const rankingAttempts: any[] = [];

        // Process each provider individually for better progress tracking
        for (const provider of activeProviders) {
          if (!provider.is_active) continue;

          // Update current provider
          analysisProgress = {
            ...analysisProgress,
            currentProvider: provider.name
          };

          // Make 5 attempts for this provider
          for (let attemptNum = 1; attemptNum <= 5; attemptNum++) {
            try {
              console.log(`🤖 ${provider.name} - Attempt ${attemptNum}/5`);
              
              const result = await LLMService.makeRequest(provider, query.text, dashboardData.business.name, 25);
              
              // Update progress after each API call
              const newStep = analysisProgress.currentStep + 1;
              analysisProgress = {
                ...analysisProgress,
                currentStep: newStep,
                percentage: Math.round((newStep / analysisProgress.totalSteps) * 100)
              };

              console.log(`📈 Progress updated: ${newStep}/${analysisProgress.totalSteps} (${analysisProgress.percentage}%) - ${provider.name} attempt ${attemptNum}`);

              // Only save successful requests to the database
              if (result.success) {
                rankingAttempts.push({
                  analysis_run_id: analysisRun.id,
                  query_id: query.id,
                  llm_provider_id: provider.id,
                  attempt_number: attemptNum,
                  parsed_ranking: result.rankedBusinesses,
                  target_business_rank: result.foundBusinessRank,
                  success: result.success,
                  error_message: result.error || null,
                });

                if (result.foundBusinessRank) {
                  console.log(`✅ Found "${dashboardData.business.name}" as "${result.foundBusinessName}" at rank ${result.foundBusinessRank}/${result.totalRequested}`);
                } else {
                  console.log(`❌ "${dashboardData.business.name}" not found in results`);
                }
              } else {
                console.warn(`❌ Failed LLM request from ${provider.name}, attempt ${attemptNum}: ${result.error}`);
              }

              // Small delay between requests to make progress visible and be nice to APIs
              if (attemptNum < 5) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            } catch (err) {
              console.error(`💥 Error in ${provider.name} attempt ${attemptNum}:`, err);
              
              // Check if this is an API key error
              const errorMessage = err instanceof Error ? err.message : String(err);
              if (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('authentication')) {
                console.warn(`🔑 ${provider.name} appears to have authentication issues - skipping remaining attempts`);
                
                // Skip remaining attempts for this provider and update progress accordingly
                const remainingAttempts = 5 - attemptNum;
                const newStep = analysisProgress.currentStep + remainingAttempts;
                analysisProgress = {
                  ...analysisProgress,
                  currentStep: newStep,
                  percentage: Math.round((newStep / analysisProgress.totalSteps) * 100)
                };
                console.log(`📈 Progress updated (skipped ${remainingAttempts} attempts): ${newStep}/${analysisProgress.totalSteps} (${analysisProgress.percentage}%) - ${provider.name} auth failed`);
                break; // Exit the attempt loop for this provider
              }
              
              // Still update progress even on error
              const newStep = analysisProgress.currentStep + 1;
              analysisProgress = {
                ...analysisProgress,
                currentStep: newStep,
                percentage: Math.round((newStep / analysisProgress.totalSteps) * 100)
              };
              console.log(`📈 Progress updated (error): ${newStep}/${analysisProgress.totalSteps} (${analysisProgress.percentage}%) - ${provider.name} attempt ${attemptNum} failed`);
            }
          }
        }

        if (rankingAttempts.length > 0) {
          await DatabaseService.saveRankingAttempts(rankingAttempts);
        } else {
          console.warn("⚠️ No ranking attempts to save");
        }
      }

      // Update analysis run status to completed
      await DatabaseService.updateAnalysisRun(analysisRun.id, {
        status: "completed",
        completed_queries: dashboardData.queries.length,
        completed_llm_calls:
          dashboardData.queries.length * activeProviders.length * 5,
        completed_at: new Date().toISOString(),
      });

      console.log("✅ Weekly analysis completed successfully!");
      
      // Refresh dashboard data and weekly check
      await loadDashboardData();
      await checkWeeklyAnalysis();
    } catch (err) {
      console.error("❌ Weekly analysis failed:", err);
      error = err instanceof Error ? err.message : "Failed to run weekly analysis";
      
      // If we created an analysis run, mark it as failed
      if (analysisRun?.id) {
        try {
          await DatabaseService.updateAnalysisRun(analysisRun.id, {
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
            completed_at: new Date().toISOString(),
          });
        } catch (updateError) {
          console.error("Failed to update analysis run status:", updateError);
        }
      }
      error = err instanceof Error ? err.message : "Failed to run analysis";
    } finally {
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
      onAddQuery={addQuery}
      onRunAnalysis={runAnalysis}
    />
        
        <!-- Analysis Progress Bar -->
        {#if runningAnalysis}
          <AnalysisProgressBar progress={analysisProgress} />
        {/if}

        {#if dashboardData}
          <QueryGrid
            queries={dashboardData.queries}
            analytics={dashboardData.analytics}
            onAddQuery={() => (showAddQuery = true)}
            onGetAISuggestions={() => (showQuerySuggestions = true)}
          />
          
          <!-- Weekly Analysis History -->
          <div class="mt-8">
            <WeeklyAnalysisHistory businessId={business.id} />
          </div>
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
