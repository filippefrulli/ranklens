<script lang="ts">
  import type { Company } from '../../types'
  
  export let business: Company | null
</script>

{#if business}
  <div class="mb-6">
    <div class="inline-flex items-center p-4 pr-16 bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="flex items-center space-x-3">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-black/5 rounded-full flex items-center justify-center">
            <svg class="w-5 h-5 text-[rgb(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
            </svg>
          </div>
        </div>
        <div>
          <h2 class="text-lg font-semibold text-gray-900">{business.name}</h2>
        </div>
      </div>
    </div>
  </div>
{/if}
