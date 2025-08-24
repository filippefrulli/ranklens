<script lang="ts">
  import type { LLMProvider, WeeklyAnalysisCheck } from '../../types'
  
  export let llmProviders: LLMProvider[]
  export let selectedProvider: LLMProvider | null
  export let hasQueries: boolean
  export let runningAnalysis: boolean
  export let weeklyCheck: WeeklyAnalysisCheck
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
      <div class="relative">
        <button
          onclick={onRunAnalysis}
          disabled={!weeklyCheck.canRun || runningAnalysis}
          class="text-sm font-medium py-2 px-4 rounded-md transition-colors cursor-pointer
            {weeklyCheck.canRun && !runningAnalysis
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'}"
        >
          {runningAnalysis ? "Running Analysis..." : "Run Weekly Analysis"}
        </button>

        {#if !weeklyCheck.canRun && weeklyCheck.nextAllowedDate}
          <div class="absolute top-full left-0 mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700 whitespace-nowrap z-10">
            Next analysis: {new Date(weeklyCheck.nextAllowedDate).toLocaleDateString()}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if !weeklyCheck.canRun}
  <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
    <div class="flex items-start">
      <svg class="w-5 h-5 text-yellow-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
      </svg>
      <div>
        <h4 class="text-sm font-medium text-yellow-800">Weekly Analysis Complete</h4>
        <p class="text-sm text-yellow-700 mt-1">
          {#if weeklyCheck.lastRunDate}
            Last analysis was completed on {new Date(weeklyCheck.lastRunDate).toLocaleDateString()}.
          {/if}
          Next analysis will be available on {weeklyCheck.nextAllowedDate ? new Date(weeklyCheck.nextAllowedDate).toLocaleDateString() : 'next week'}.
        </p>
      </div>
    </div>
  </div>
{/if}
