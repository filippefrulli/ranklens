<script lang="ts">
  import type { PageData } from './$types'
  import type { SourceInfo, BlindSpotAnalysis } from '$lib/types'
  
  const { data }: { data: PageData } = $props()
  
  let selectedQueryId = $state<string | null>(null)
  let blindSpotAnalysis = $state<BlindSpotAnalysis | null>(null)

  // Get importance badge classes
  function getImportanceBadge(importance: string) {
    switch (importance) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get category icon
  function getCategoryIcon(category: string) {
    switch (category.toLowerCase()) {
      case 'review platform':
        return '⭐'
      case 'business directory':
        return '📋'
      case 'social media':
        return '📱'
      case 'local listings':
        return '📍'
      default:
        return '🌐'
    }
  }

  // Calculate blind spots when query is selected
  function analyzeBlindSpots(queryId: string) {
    const querySource = data.querySources.find(qs => qs.query_id === queryId)
    if (!querySource || !data.businessSources) {
      blindSpotAnalysis = null
      return
    }

    // Import and use the analysis function (this would need to be moved to client-side)
    // For now, implement a simple version
    const queryPlatforms = new Set(querySource.sources.map(s => s.platform.toLowerCase()))
    const businessPlatforms = new Set(data.businessSources.sources.map(s => s.platform.toLowerCase()))

    const missing_platforms = querySource.sources.filter(
      source => !businessPlatforms.has(source.platform.toLowerCase())
    )

    const underutilized_platforms = data.businessSources.sources.filter(
      source => !queryPlatforms.has(source.platform.toLowerCase())
    )

    const opportunities = missing_platforms.filter(
      source => source.importance === 'high'
    )

    blindSpotAnalysis = {
      missing_platforms,
      underutilized_platforms,
      opportunities
    }
  }

  // Handle query selection
  function selectQuery(queryId: string) {
    selectedQueryId = queryId === selectedQueryId ? null : queryId
    if (selectedQueryId) {
      analyzeBlindSpots(selectedQueryId)
    } else {
      blindSpotAnalysis = null
    }
  }

  // Get selected query data
  const selectedQuery = $derived(
    selectedQueryId ? data.queries.find(q => q.id === selectedQueryId) : null
  )
  const selectedQuerySources = $derived(
    selectedQueryId ? data.querySources.find(qs => qs.query_id === selectedQueryId) : null
  )
</script>

<svelte:head>
  <title>Sources Analysis - RankLens</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Sources Analysis</h1>
          <p class="mt-2 text-gray-600">
            Understand what sources influence your business rankings and identify optimization opportunities
          </p>
        </div>
        <a
          href="/"
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          ← Back to Dashboard
        </a>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left Column: Business Sources -->
      <div class="lg:col-span-1">
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">
            {data.business.name} Sources
          </h2>
          
          {#if data.businessSources && data.businessSources.sources.length > 0}
            <div class="space-y-3">
              {#each data.businessSources.sources as source}
                <div class="border border-gray-200 rounded-lg p-3">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-lg">{getCategoryIcon(source.category)}</span>
                        <h3 class="font-medium text-sm text-gray-900">{source.platform}</h3>
                        <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {getImportanceBadge(source.importance)}">
                          {source.importance}
                        </span>
                      </div>
                      <p class="text-xs text-gray-600 mb-2">{source.description}</p>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Visit Source →
                      </a>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
            
            <div class="mt-4 p-3 bg-gray-50 rounded-lg">
              <p class="text-xs text-gray-600">
                Last updated: {new Date(data.businessSources.last_updated).toLocaleDateString()}
              </p>
            </div>
          {:else}
            <div class="text-center py-8">
              <div class="text-gray-400 mb-2">📊</div>
              <p class="text-sm text-gray-500">No business sources found</p>
              <p class="text-xs text-gray-400 mt-1">Run an analysis to discover sources</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Right Column: Query Sources & Analysis -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Query Selection -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Query Sources</h2>
          
          {#if data.queries.length === 0}
            <div class="text-center py-8">
              <div class="text-gray-400 mb-2">❓</div>
              <p class="text-sm text-gray-500">No queries found</p>
              <p class="text-xs text-gray-400 mt-1">Add queries to your dashboard first</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 gap-3 mb-6">
              {#each data.queries as query}
                {@const hasSourceData = data.querySources.some(qs => qs.query_id === query.id)}
                <button
                  onclick={() => selectQuery(query.id)}
                  class="text-left p-4 border-2 rounded-lg transition-all {selectedQueryId === query.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'}"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h3 class="font-medium text-sm text-gray-900 mb-1">{query.text}</h3>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500">
                          Created: {new Date(query.created_at).toLocaleDateString()}
                        </span>
                        {#if hasSourceData}
                          <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            Sources Available
                          </span>
                        {:else}
                          <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            No Sources
                          </span>
                        {/if}
                      </div>
                    </div>
                    <div class="text-gray-400">
                      {selectedQueryId === query.id ? '▼' : '▶'}
                    </div>
                  </div>
                </button>
              {/each}
            </div>

            <!-- Selected Query Sources -->
            {#if selectedQuery && selectedQuerySources}
              <div class="border-t border-gray-200 pt-6">
                <h3 class="font-medium text-gray-900 mb-4">
                  Sources for: "{selectedQuery.text}"
                </h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {#each selectedQuerySources.sources as source}
                    <div class="border border-gray-200 rounded-lg p-3">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-lg">{getCategoryIcon(source.category)}</span>
                            <h4 class="font-medium text-sm text-gray-900">{source.platform}</h4>
                            <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {getImportanceBadge(source.importance)}">
                              {source.importance}
                            </span>
                          </div>
                          <p class="text-xs text-gray-600 mb-2">{source.description}</p>
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Visit Source →
                          </a>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        </div>

        <!-- Blind Spots Analysis -->
        {#if blindSpotAnalysis && data.businessSources}
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">🎯 Optimization Opportunities</h2>
            
            <!-- High Priority Opportunities -->
            {#if blindSpotAnalysis.opportunities.length > 0}
              <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 class="font-medium text-red-900 mb-3">🚨 High Priority Missing Platforms</h3>
                <div class="space-y-2">
                  {#each blindSpotAnalysis.opportunities as source}
                    <div class="flex items-center justify-between p-2 bg-white rounded border">
                      <div>
                        <span class="font-medium text-sm text-gray-900">{source.platform}</span>
                        <p class="text-xs text-gray-600">{source.description}</p>
                      </div>
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Create Profile
                      </a>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Missing Platforms -->
            {#if blindSpotAnalysis.missing_platforms.length > 0}
              <div class="mb-6">
                <h3 class="font-medium text-gray-900 mb-3">📋 Missing from Your Business</h3>
                <p class="text-sm text-gray-600 mb-3">These platforms are used for ranking but don't have your business listed:</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {#each blindSpotAnalysis.missing_platforms as source}
                    <div class="p-3 border border-orange-200 bg-orange-50 rounded-lg">
                      <div class="flex items-center justify-between">
                        <div>
                          <span class="font-medium text-sm text-gray-900">{source.platform}</span>
                          <span class="ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full {getImportanceBadge(source.importance)}">
                            {source.importance}
                          </span>
                          <p class="text-xs text-gray-600 mt-1">{source.description}</p>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Underutilized Platforms -->
            {#if blindSpotAnalysis.underutilized_platforms.length > 0}
              <div>
                <h3 class="font-medium text-gray-900 mb-3">💡 Optimize Existing Presence</h3>
                <p class="text-sm text-gray-600 mb-3">You're on these platforms but they're not commonly used for this query type:</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {#each blindSpotAnalysis.underutilized_platforms as source}
                    <div class="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                      <div class="flex items-center justify-between">
                        <div>
                          <span class="font-medium text-sm text-gray-900">{source.platform}</span>
                          <span class="ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full {getImportanceBadge(source.importance)}">
                            {source.importance}
                          </span>
                          <p class="text-xs text-gray-600 mt-1">{source.description}</p>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if blindSpotAnalysis.missing_platforms.length === 0 && blindSpotAnalysis.opportunities.length === 0}
              <div class="text-center py-8">
                <div class="text-green-500 text-4xl mb-2">✅</div>
                <h3 class="font-medium text-green-900 mb-2">Great Coverage!</h3>
                <p class="text-sm text-green-700">Your business appears on all major platforms used for this query type.</p>
              </div>
            {/if}
          </div>
        {:else if selectedQuery}
          <div class="bg-white rounded-lg shadow p-6">
            <div class="text-center py-8">
              <div class="text-gray-400 text-4xl mb-2">📊</div>
              <h3 class="font-medium text-gray-900 mb-2">No Source Analysis Available</h3>
              <p class="text-sm text-gray-600">Run an analysis to discover optimization opportunities</p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
