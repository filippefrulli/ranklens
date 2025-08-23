<script lang="ts">
  import { onMount } from "svelte";
  import { DatabaseService } from "../../services/database-service";
  import { LLMService } from "../../services/llm-service";
  import { AuthService, user } from "../../services/auth-service";
  import type {
    Business,
    DashboardData,
    LLMProvider,
  } from "../../types";
  import GoogleBusinessSearch from "../business/GoogleBusinessSearch.svelte";
  import DashboardHeader from "./DashboardHeader.svelte";
  import BusinessNameBar from "./BusinessNameBar.svelte";
  import DashboardControls from "./DashboardControls.svelte";
  import QueryGrid from "./QueryGrid.svelte";
  import BusinessRegistration from "./BusinessRegistration.svelte";
  import AddQueryModal from "./AddQueryModal.svelte";
  import CreateBusinessModal from "./CreateBusinessModal.svelte";

  let business = $state<Business | null>(null);
  let dashboardData = $state<DashboardData | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let llmProviders = $state<LLMProvider[]>([]);
  let selectedProvider = $state<LLMProvider | null>(null);

  // Modal states
  let showCreateBusiness = $state(false);
  let showGoogleSearch = $state(false);
  let showAddQuery = $state(false);
  let runningAnalysis = $state(false);

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

  async function loadBusiness() {
    if (!$user) return;

    try {
      loading = true;
      error = null;
      business = await DatabaseService.getBusiness($user.id);

      // If business exists, load dashboard data (including queries)
      if (business) {
        await loadDashboardData();
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

  async function runAnalysis() {
    console.log("🚀 Starting analysis...");
    console.log("Dashboard data:", dashboardData);

    if (!dashboardData?.business) {
      console.error("❌ No business found in dashboard data");
      return;
    }

    if (!dashboardData?.queries.length) {
      console.error("❌ No queries found in dashboard data");
      return;
    }

    try {
      runningAnalysis = true;
      error = null;

      const providers = await DatabaseService.getLLMProviders();

      const activeProviders = providers.filter((p) => p.is_active);

      if (activeProviders.length === 0) {
        throw new Error("No active LLM providers found");
      }

      // Create an analysis run for this session
      const analysisRun = await DatabaseService.createAnalysisRun(
        dashboardData.business.id,
        dashboardData.queries.length
      );

      for (let i = 0; i < dashboardData.queries.length; i++) {
        const query = dashboardData.queries[i];

        const results = await LLMService.runRankingAnalysis(
          activeProviders,
          query.text,
          dashboardData.business.name,
          5
        );

        const rankingAttempts: any[] = [];

        for (const [providerName, responses] of results.entries()) {
          const provider = activeProviders.find((p) => p.name === providerName);
          if (!provider) {
            console.warn(
              `⚠️ Provider ${providerName} not found in active providers`
            );
            continue;
          }

          responses.forEach((response, index) => {
            // Only save successful requests to the database
            if (response.success) {
              rankingAttempts.push({
                analysis_run_id: analysisRun.id,
                query_id: query.id,
                llm_provider_id: provider.id,
                attempt_number: index + 1,
                parsed_ranking: response.rankedBusinesses,
                target_business_rank: response.foundBusinessRank,
                success: response.success,
                error_message: response.error || null,
              });
            } else {
              console.warn(
                `❌ Skipping failed LLM request from ${providerName}, attempt ${index + 1}: ${response.error}`
              );
            }
          });
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

      // Refresh dashboard data
      await loadDashboardData();
    } catch (err) {
      console.error("❌ Analysis failed:", err);
      error = err instanceof Error ? err.message : "Failed to run analysis";
    } finally {
      runningAnalysis = false;
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
          bind:selectedProvider
          hasQueries={!!dashboardData?.queries.length}
          {runningAnalysis}
          onAddQuery={() => (showAddQuery = true)}
          onRunAnalysis={runAnalysis}
        />

        {#if dashboardData}
          <QueryGrid
            queries={dashboardData.queries}
            analytics={dashboardData.analytics}
            onAddQuery={() => (showAddQuery = true)}
          />
        {/if}
      </div>

      <!-- Back to projects -->
      <div class="text-center mt-8">
        <button
          onclick={() => {
            business = null;
            dashboardData = null;
          }}
          class="text-blue-600 hover:text-blue-800 text-sm font-medium cursor-pointer"
        >
          ← Back to Business Registration
        </button>
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
  />    <!-- Error Toast -->
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

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
