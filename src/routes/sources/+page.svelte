<script lang="ts">
  import type { PageData } from './$types'
  import type { SourceInfo, BlindSpotAnalysis } from '$lib/types'
  
  const { data }: { data: PageData } = $props()
  
  // Initialize with first query selected by default
  let selectedQueryId = $state<string | null>(data.queries.length > 0 ? data.queries[0].id : null)

  // Handle query selection from dropdown
  function handleQueryChange(event: Event) {
    const target = event.target as HTMLSelectElement
    selectedQueryId = target.value || null
  }

  // Calculate missing platforms for the selected query only
  const missingPlatformsForQuery = $derived.by(() => {
    if (!data.businessSources || !selectedQueryId) {
      return []
    }

    const selectedQuerySources = data.querySources.find(qs => qs.query_id === selectedQueryId)
    if (!selectedQuerySources) {
      return []
    }

    const businessPlatforms = new Set(data.businessSources.sources.map((s: SourceInfo) => s.platform.toLowerCase()))
    
    const missingPlatforms = selectedQuerySources.sources.filter(source => 
      !businessPlatforms.has(source.platform.toLowerCase())
    )
    
    // Sort by importance (high first)
    return missingPlatforms.sort((a, b) => {
      const importanceOrder = { 'high': 0, 'medium': 1, 'low': 2 }
      return importanceOrder[a.importance] - importanceOrder[b.importance]
    })
  })

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

    <!-- Missing Platforms Section -->
    {#if data.businessSources && data.querySources.length > 0 && data.queries.length > 0}
      <div class="mb-8">
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <div class="flex items-start">
            <div class="flex-shrink-0">
              <div class="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                <span class="text-blue-600 font-bold">🎯</span>
              </div>
            </div>
            <div class="ml-3 flex-1">
              <h2 class="text-lg font-semibold text-blue-900 mb-4">Missing Platforms</h2>
              
              <!-- Query Selection Dropdown -->
              <div class="mb-4">
                <label for="query-select" class="block text-sm font-medium text-blue-800 mb-2">
                  Select Query:
                </label>
                <select
                  id="query-select"
                  value={selectedQueryId}
                  onchange={handleQueryChange}
                  class="block w-full max-w-md px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                >
                  {#each data.queries as query}
                    <option value={query.id}>{query.text}</option>
                  {/each}
                </select>
              </div>
              
              <p class="text-sm text-blue-700 mb-4">
                These platforms are mentioned when recommending the competitors that rank better than you, but not your business:
              </p>
              
              {#if missingPlatformsForQuery.length > 0}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {#each missingPlatformsForQuery as platform}
                    <div class="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <span class="text-lg">{getCategoryIcon(platform.category)}</span>
                          <h3 class="font-medium text-sm text-gray-900">{platform.platform}</h3>
                        </div>
                        <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full {getImportanceBadge(platform.importance)}">
                          {platform.importance}
                        </span>
                      </div>
                      <p class="text-xs text-gray-600">{platform.description}</p>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="bg-white border border-green-200 rounded-lg p-4">
                  <div class="flex items-center">
                    <span class="text-green-500 text-lg mr-2">✅</span>
                    <div>
                      <h3 class="font-medium text-green-900">Complete Coverage!</h3>
                      <p class="text-sm text-green-700">Your business appears on all platforms found in the ranking sources for this query.</p>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {:else}
      <div class="text-center py-12">
        <div class="text-gray-400 mb-4">📊</div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">No Source Data Available</h2>
        <p class="text-gray-600 mb-4">Run an analysis to discover ranking sources and optimization opportunities.</p>
        <a
          href="/"
          class="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    {/if}
  </div>
</div>
