<script lang="ts">
  export let show: boolean
  export let loading: boolean
  export let business: {
    name: string
    google_place_id: string
    city: string
    google_primary_type_display: string
  }
  export let onBackToSearch: () => void
</script>

{#if show}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <form method="POST" action="?/createBusiness">
        <div class="text-center">
          <div class="mb-4">
            <div class="w-12 h-12 mx-auto bg-black/5 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-[rgb(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <!-- Hidden form fields -->
          <input type="hidden" name="name" value={business.name} />
          <input type="hidden" name="google_place_id" value={business.google_place_id} />
          <input type="hidden" name="city" value={business.city} />
          <input type="hidden" name="google_primary_type_display" value={business.google_primary_type_display} />

          <div class="flex justify-center space-x-3">
            <button
              type="button"
              onclick={onBackToSearch}
              class="px-4 py-2 text-md font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
            >
              Back to Search
            </button>
            <button
              type="submit"
              disabled={loading}
              class="px-6 py-2 text-md font-medium text-white bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary))] disabled:bg-gray-400 rounded-md transition-colors cursor-pointer"
            >
              {loading ? "Registering..." : "Confirm"}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}
