<script lang="ts">
  import type { Business } from '../../types'
  
  export let business: Business | null
</script>

{#if business}
  <div class="bg-gray-100 border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
      <h2 class="text-xl font-semibold text-gray-800">{business.name}</h2>
    </div>
  </div>
{/if}
