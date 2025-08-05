<script lang="ts">
  import { onMount } from 'svelte'
  import { DatabaseService } from '../services/database-service'
  import { LLMService } from '../services/llm-service'
  import { AuthService, user } from '../auth'
  import type { Project, Query, DashboardData } from '../types'

  let projects = $state<Project[]>([])
  let selectedProject = $state<Project | null>(null)
  let dashboardData = $state<DashboardData | null>(null)
  let loading = $state(false)
  let error = $state<string | null>(null)

  // New project form
  let showCreateProject = $state(false)
  let newProject = $state({
    name: '',
    business_name: '',
    industry: '',
    location: ''
  })

  // New query form
  let showAddQuery = $state(false)
  let newQuery = $state('')
  let runningAnalysis = $state(false)

  onMount(async () => {
    if ($user) {
      await loadProjects()
    }
  })

  async function loadProjects() {
    if (!$user) return
    
    try {
      loading = true
      error = null
      projects = await DatabaseService.getProjects($user.id)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load projects'
    } finally {
      loading = false
    }
  }

  async function createProject() {
    if (!$user) return

    try {
      loading = true
      error = null
      
      const project = await DatabaseService.createProject({
        ...newProject,
        user_id: $user.id
      })
      
      projects = [project, ...projects]
      showCreateProject = false
      newProject = { name: '', business_name: '', industry: '', location: '' }
      
      // Auto-select the new project
      await selectProject(project)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create project'
    } finally {
      loading = false
    }
  }

  async function selectProject(project: Project) {
    try {
      loading = true
      error = null
      selectedProject = project
      dashboardData = await DatabaseService.getDashboardData(project.id)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load project data'
    } finally {
      loading = false
    }
  }

  async function addQuery() {
    if (!selectedProject || !newQuery.trim()) return

    try {
      loading = true
      error = null
      
      const existingQueries = dashboardData?.queries || []
      const query = await DatabaseService.createQuery({
        project_id: selectedProject.id,
        text: newQuery.trim(),
        order_index: existingQueries.length
      })
      
      // Refresh dashboard data
      await selectProject(selectedProject)
      
      showAddQuery = false
      newQuery = ''
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add query'
    } finally {
      loading = false
    }
  }

  async function runAnalysis() {
    if (!selectedProject || !dashboardData?.queries.length) return

    try {
      runningAnalysis = true
      error = null

      const providers = await DatabaseService.getLLMProviders()
      
      for (const query of dashboardData.queries) {
        const results = await LLMService.runRankingAnalysis(
          providers,
          query.text,
          selectedProject.business_name,
          5
        )

        // Save results to database
        const rankingResults: any[] = []
        
        for (const [providerName, responses] of results.entries()) {
          const provider = providers.find(p => p.name === providerName)
          if (!provider) continue

          responses.forEach((response, index) => {
            if (response.success) {
              const targetRank = response.rankedBusinesses.findIndex(
                business => business.toLowerCase().includes(selectedProject!.business_name.toLowerCase())
              )

              rankingResults.push({
                query_id: query.id,
                llm_provider_id: provider.id,
                attempt_number: index + 1,
                ranked_businesses: response.rankedBusinesses,
                target_business_rank: targetRank >= 0 ? targetRank + 1 : null,
                response_time_ms: response.responseTimeMs
              })
            }
          })
        }

        if (rankingResults.length > 0) {
          await DatabaseService.saveRankingResults(rankingResults)
        }
      }

      // Refresh dashboard data
      await selectProject(selectedProject)
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to run analysis'
    } finally {
      runningAnalysis = false
    }
  }

  async function signOut() {
    await AuthService.signOut()
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <h1 class="text-2xl font-bold text-gray-900">RankLens</h1>
          {#if selectedProject}
            <span class="ml-4 text-gray-500">→</span>
            <span class="ml-2 text-lg text-gray-700">{selectedProject.name}</span>
          {/if}
        </div>
        
        {#if $user}
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-600">{$user.email}</span>
            <button 
              onclick={signOut}
              class="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {#if !$user}
      <!-- Auth placeholder -->
      <div class="text-center py-12">
        <h2 class="text-xl text-gray-600">Please sign in to continue</h2>
        <p class="text-sm text-gray-500 mt-2">Configure your Supabase authentication to get started</p>
      </div>
    
    {:else if !selectedProject}
      <!-- Project selection -->
      <div class="text-center py-12">
        <h2 class="text-2xl font-bold text-gray-900 mb-8">Your Projects</h2>
        
        {#if projects.length === 0}
          <div class="mb-8">
            <p class="text-gray-600 mb-4">No projects yet. Create your first project to get started!</p>
          </div>
        {:else}
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {#each projects as project}
              <button 
                type="button"
                class="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow text-left w-full"
                onclick={() => selectProject(project)}
              >
                <h3 class="text-lg font-semibold text-gray-900 mb-2">{project.name}</h3>
                <p class="text-sm text-gray-600 mb-1">Business: {project.business_name}</p>
                {#if project.industry}
                  <p class="text-sm text-gray-500">Industry: {project.industry}</p>
                {/if}
                {#if project.location}
                  <p class="text-sm text-gray-500">Location: {project.location}</p>
                {/if}
              </button>
            {/each}
          </div>
        {/if}

        <button 
          onclick={() => showCreateProject = true}
          class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors"
        >
          Create New Project
        </button>
      </div>

    {:else}
      <!-- Dashboard -->
      <div class="space-y-8">
        <!-- Quick Stats -->
        {#if dashboardData}
          <div class="grid md:grid-cols-4 gap-6">
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-sm font-medium text-gray-500">Total Queries</h3>
              <p class="text-3xl font-bold text-gray-900">{dashboardData.overall_stats.total_queries}</p>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-sm font-medium text-gray-500">LLM Calls</h3>
              <p class="text-3xl font-bold text-gray-900">{dashboardData.overall_stats.total_llm_calls}</p>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-sm font-medium text-gray-500">Average Rank</h3>
              <p class="text-3xl font-bold text-gray-900">
                {dashboardData.overall_stats.overall_average_rank 
                  ? dashboardData.overall_stats.overall_average_rank.toFixed(1) 
                  : 'N/A'}
              </p>
            </div>
            
            <div class="bg-white rounded-lg shadow-md p-6">
              <h3 class="text-sm font-medium text-gray-500">Total Mentions</h3>
              <p class="text-3xl font-bold text-gray-900">{dashboardData.overall_stats.total_mentions}</p>
            </div>
          </div>
        {/if}

        <!-- Queries Section -->
        <div class="bg-white rounded-lg shadow-md">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-semibold text-gray-900">Queries</h2>
              <div class="space-x-2">
                <button 
                  onclick={() => showAddQuery = true}
                  class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Add Query
                </button>
                
                {#if dashboardData?.queries.length}
                  <button 
                    onclick={runAnalysis}
                    disabled={runningAnalysis}
                    class="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
                  >
                    {runningAnalysis ? 'Running Analysis...' : 'Run Analysis'}
                  </button>
                {/if}
              </div>
            </div>
          </div>
          
          <div class="p-6">
            {#if dashboardData?.queries.length === 0}
              <p class="text-gray-600">No queries yet. Add your first query to start analyzing rankings!</p>
            {:else if dashboardData}
              <div class="space-y-6">
                {#each dashboardData.analytics as analytic}
                  <div class="border border-gray-200 rounded-lg p-4">
                    <h3 class="font-medium text-gray-900 mb-2">{analytic.query_text}</h3>
                    
                    <div class="grid md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span class="text-gray-500">Average Rank:</span>
                        <span class="font-medium">
                          {analytic.average_rank ? analytic.average_rank.toFixed(1) : 'Not found'}
                        </span>
                      </div>
                      
                      <div>
                        <span class="text-gray-500">Total Mentions:</span>
                        <span class="font-medium">{analytic.total_mentions}</span>
                      </div>
                      
                      <div>
                        <span class="text-gray-500">LLM Sources:</span>
                        <span class="font-medium">{analytic.llm_breakdown.length}</span>
                      </div>
                    </div>

                    {#if analytic.competitors_ranked_higher.length > 0}
                      <div class="mt-3">
                        <h4 class="text-sm font-medium text-gray-700 mb-2">Top Competitors:</h4>
                        <div class="flex flex-wrap gap-2">
                          {#each analytic.competitors_ranked_higher.slice(0, 3) as competitor}
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {competitor.business_name} (#{competitor.average_rank.toFixed(1)})
                            </span>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Back to projects -->
        <div class="text-center">
          <button 
            onclick={() => { selectedProject = null; dashboardData = null }}
            class="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Projects
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Create Project Modal -->
  {#if showCreateProject}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Create New Project</h3>
        
        <form onsubmit={e => { e.preventDefault(); createProject(); }} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input 
              bind:value={newProject.name}
              type="text" 
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Restaurant Analysis"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input 
              bind:value={newProject.business_name}
              type="text" 
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Joe's Pizza"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Industry (Optional)</label>
            <input 
              bind:value={newProject.industry}
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Restaurant"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
            <input 
              bind:value={newProject.location}
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="New York, NY"
            />
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              onclick={() => showCreateProject = false}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Add Query Modal -->
  {#if showAddQuery}
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Add Query</h3>
        
        <form onsubmit={e => { e.preventDefault(); addQuery(); }} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Query Text</label>
            <textarea 
              bind:value={newQuery}
              required
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Best pizza place in New York"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">This query will be sent to all LLM providers to get ranking lists.</p>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              onclick={() => showAddQuery = false}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors"
            >
              {loading ? 'Adding...' : 'Add Query'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Error Toast -->
  {#if error}
    <div class="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50">
      <div class="flex items-center justify-between">
        <span>{error}</span>
        <button onclick={() => error = null} class="ml-4 text-red-500 hover:text-red-700">✕</button>
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
