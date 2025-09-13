<script lang="ts">
  import LLMProviderDropdown from '../ui/LLMProviderDropdown.svelte'
  import type { LLMProvider } from '../../types'
  
  export let query: any
  export let goBack: () => void
  export let llmProviders: LLMProvider[] = []
  export let selectedProvider: LLMProvider | null = null
  export let onProviderChange: (provider: LLMProvider | null) => void = () => {}
</script>

<!-- Back to Dashboard Button - Outside and above the card -->
<div class="mb-4">
  <button 
    onclick={goBack}
    class="text-black border border-black hover:bg-gray-50 font-medium px-3 py-2 rounded-md inline-flex items-center cursor-pointer transition-colors"
  >
    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
    </svg>
    Back to Dashboard
  </button>
</div>

<!-- Query Information Card -->
<div class="bg-white shadow rounded-lg p-6 mb-6">
  <div class="flex items-center justify-between">
    <div class="flex-1">
      <p class="text-lg text-gray-700 font-bold">{query.text}</p>
      <div class="mt-2 flex items-center space-x-4 text-sm text-gray-500">
        <span>Date: {new Date(query.created_at).toLocaleDateString()}</span>
      </div>
    </div>
    
    <!-- LLM Provider Filter -->
    {#if llmProviders.length > 0}
      <div class="ml-6 min-w-0 flex-shrink-0">
        <div class="mb-2">
          <h3 class="text-base font-medium text-gray-900">Filter by Provider</h3>
        </div>
        <div class="w-80">
          <LLMProviderDropdown 
            providers={llmProviders}
            selectedProvider={selectedProvider}
            onProviderChange={onProviderChange}
            showLabel={false}
            size="lg"
          />
        </div>
      </div>
    {/if}
  </div>
</div>
