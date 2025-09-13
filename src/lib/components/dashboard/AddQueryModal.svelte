<script lang="ts">
  export let show: boolean;
  export let loading: boolean;
  export let newQuery: string;
  export let onSubmit: () => void;
  export let onClose: () => void;
  export let isAIGenerated: boolean = false;
</script>

{#if show}
  <div
    class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
      {#if isAIGenerated}
        <div class="flex items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-900">
            Review and Edit Query
          </h3>
        </div>
      {:else}
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Add Query</h3>
      {/if}

      <form
        onsubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        class="space-y-4"
      >
        <div>
          <textarea
            id="query-text"
            bind:value={newQuery}
            required
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={isAIGenerated
              ? "Edit the AI suggestion..."
              : "Best pizza place in Dublin"}
          ></textarea>
          {#if isAIGenerated}
            <p class="text-xs text-blue-600 mt-1 flex items-center">
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clip-rule="evenodd"
                ></path>
              </svg>
              You can edit this query or use it as-is.
            </p>
          {:else}
            <p class="text-xs text-gray-500 mt-1">
              Enter a search phrase that represents what customers might search
              for when looking for your business.
            </p>
          {/if}
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
            {loading
              ? "Adding..."
              : isAIGenerated
                ? "Add AI Query"
                : "Add Query"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
