<script lang="ts">
  export let show: boolean
  export let loading: boolean
  export let business: {
    name: string
    google_place_id: string
    city: string
    google_primary_type_display: string
  }
  export let onSubmit: () => void
  export let onBackToSearch: () => void
</script>

{#if show}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <div class="text-center">
        <div class="mb-4">
          <div class="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
            </svg>
          </div>
        </div>

        <h3 class="text-lg text-gray-900 mb-2">
          Register Business
        </h3>
        
        <p class="text-xl font-semibold text-gray-900 mb-6">
          {business.name}
        </p>

        <div class="flex justify-center space-x-3">
          <button
            type="button"
            onclick={onBackToSearch}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
          >
            Back to Search
          </button>
          <button
            type="button"
            onclick={onSubmit}
            disabled={loading}
            class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors cursor-pointer"
          >
            {loading ? "Registering..." : "Confirm & Register"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
