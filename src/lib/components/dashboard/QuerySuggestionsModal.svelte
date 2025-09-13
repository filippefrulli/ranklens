<script lang="ts">
  import type { Business, QuerySuggestion } from '../../types'
  
  interface Props {
    show: boolean
    business: Business
    onAcceptQuery: (queryText: string) => void
    onClose: () => void
    generateSuggestions: () => Promise<QuerySuggestion[]>
  }
  
  let { show, business, onAcceptQuery, onClose, generateSuggestions }: Props = $props()

  let suggestions: QuerySuggestion[] = $state([])
  let loading = $state(false)
  let error = $state<string | null>(null)

  async function loadSuggestions() {
    if (suggestions.length > 0) return // Already generated
    
    loading = true
    error = null
    
    try {
      const generatedSuggestions = await generateSuggestions()
      suggestions = generatedSuggestions.map((s: any) => ({ ...s, accepted: false, rejected: false }))
    } catch (err) {
      console.error('❌ Error generating suggestions:', err)
      error = err instanceof Error ? err.message : 'Failed to generate suggestions'
    } finally {
      loading = false
    }
  }

  function acceptQuery(index: number) {
    const suggestion = suggestions[index]
    if (suggestion && !suggestion.accepted) {
      suggestion.accepted = true
      onAcceptQuery(suggestion.text)
    }
  }

  function rejectQuery(index: number) {
    const suggestion = suggestions[index]
    if (suggestion && !suggestion.rejected) {
      suggestion.rejected = true
    }
  }

  function regenerateSuggestions() {
    suggestions = []
    loadSuggestions()
  }

  // Generate suggestions when modal opens
  $effect(() => {
    if (show) {
      loadSuggestions()
    }
  })
</script>

{#if show}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h3 class="text-xl font-semibold text-gray-900">Query Suggestions</h3>
          <p class="text-sm text-gray-600 mt-1">
            AI-generated search queries for <span class="font-medium">{business.name}</span>
          </p>
        </div>
        <button
          onclick={onClose}
          class="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close modal"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      {#if loading}
        <div class="text-center py-12">
          <div class="inline-flex items-center space-x-2">
            <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-gray-600">Generating AI suggestions...</span>
          </div>
        </div>
      {:else if error}
        <div class="text-center py-12">
          <div class="text-red-600 mb-4">
            <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <p class="text-sm">{error}</p>
          </div>
          <button
            onclick={regenerateSuggestions}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      {:else if suggestions.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-500">No suggestions generated</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each suggestions as suggestion, index}
            <div class="border border-gray-200 rounded-lg p-4 {suggestion.accepted ? 'bg-green-50 border-green-200' : suggestion.rejected ? 'bg-gray-50 border-gray-300 opacity-60' : 'bg-white hover:bg-gray-50'} transition-all">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h4 class="font-medium text-gray-900 mb-1 {suggestion.rejected ? 'line-through text-gray-500' : ''}">
                    "{suggestion.text}"
                  </h4>
                  {#if suggestion.accepted}
                    <div class="mt-2 inline-flex items-center text-xs text-green-700">
                      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                      </svg>
                      Added to your queries
                    </div>
                  {/if}
                </div>
                
                {#if !suggestion.accepted && !suggestion.rejected}
                  <div class="flex space-x-2 ml-4">
                    <button
                      onclick={() => rejectQuery(index)}
                      class="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Reject this suggestion"
                      aria-label="Reject this suggestion"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                    <button
                      onclick={() => acceptQuery(index)}
                      class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors pointer-cursor"
                    >
                      Add Query
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <div class="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
          <button
            onclick={regenerateSuggestions}
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors cursor-pointer"
          >
            Generate New Suggestions
          </button>
          <button
            onclick={onClose}
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Done
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
