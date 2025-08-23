<script lang="ts">
  import type { LLMProvider } from '../../types'
  
  export let llmProviders: LLMProvider[]
  export let selectedProvider: LLMProvider | null
  export let hasQueries: boolean
  export let runningAnalysis: boolean
  export let onAddQuery: () => void
  export let onRunAnalysis: () => void
</script>

<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
  <!-- LLM Provider Dropdown -->
  <div class="flex items-center gap-3">
    <label for="llm-select" class="text-sm font-medium text-gray-700">
      LLM Provider:
    </label>
    <select
      id="llm-select"
      bind:value={selectedProvider}
      class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      {#each llmProviders as provider}
        <option value={provider}>{provider.name}</option>
      {/each}
    </select>
  </div>

  <!-- Action Buttons -->
  <div class="flex gap-2">
    <button
      onclick={onAddQuery}
      class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors cursor-pointer"
    >
      Add Query
    </button>

    {#if hasQueries}
      <button
        onclick={onRunAnalysis}
        disabled={runningAnalysis}
        class="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {runningAnalysis ? "Running Analysis..." : "Run Analysis"}
      </button>
    {/if}
  </div>
</div>
