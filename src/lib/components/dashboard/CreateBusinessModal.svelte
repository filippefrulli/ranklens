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
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        Confirm Business Details
      </h3>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        class="space-y-4"
      >
        <div>
          <label
            for="business-name"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Business Name
          </label>
          <input
            id="business-name"
            value={business.name}
            type="text"
            required
            readonly
            class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            for="google-place-id"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Google Place ID
          </label>
          <input
            id="google-place-id"
            value={business.google_place_id}
            type="text"
            required
            readonly
            class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            for="business-city"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            City
          </label>
          <input
            id="business-city"
            value={business.city}
            type="text"
            readonly
            class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {#if business.google_primary_type_display}
          <div>
            <span class="block text-sm font-medium text-gray-700 mb-1">
              Business Type
            </span>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {business.google_primary_type_display}
            </span>
          </div>
        {/if}

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onclick={onBackToSearch}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
          >
            Back to Search
          </button>
          <button
            type="submit"
            disabled={loading}
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors cursor-pointer"
          >
            {loading ? "Registering..." : "Register Business"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
