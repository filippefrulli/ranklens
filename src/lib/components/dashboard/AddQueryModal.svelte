<script lang="ts">
  export let show: boolean
  export let loading: boolean
  export let newQuery: string
  export let onSubmit: () => void
  export let onClose: () => void
</script>

{#if show}
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Add Query</h3>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        class="space-y-4"
      >
        <div>
          <label
            for="query-text"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Query Text
          </label>
          <textarea
            id="query-text"
            bind:value={newQuery}
            required
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Best pizza place in New York"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">
            This query will be sent to all LLM providers to get ranking lists.
          </p>
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onclick={onClose}
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors cursor-pointer"
          >
            {loading ? "Adding..." : "Add Query"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
