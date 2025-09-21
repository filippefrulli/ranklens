<script lang="ts">
  import { enhance } from '$app/forms';
  import Button from '../ui/Button.svelte';

  export let show: boolean;
  export let loading: boolean;
  export let newQuery: string;
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
        method="POST"
        action="?/addQuery"
        use:enhance={({ formData }) => {
          loading = true;
          
          return async ({ result, update }) => {
            loading = false;
            
            if (result.type === 'success') {
              newQuery = '';
              onClose();
              await update();
            } else if (result.type === 'failure' && result.data) {
              // Handle validation errors - could show error in modal
              console.error('Form validation error:', result.data);
            }
          };
        }}
        class="space-y-4"
      >
        <div>
          <textarea
            id="query-text"
            name="query"
            bind:value={newQuery}
            required
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50"
            placeholder={isAIGenerated
              ? "Edit the AI suggestion..."
              : "Best pizza place in Dublin"}
          ></textarea>
          {#if !isAIGenerated}
            <p class="text-xs text-gray-500 mt-1">
              Enter a search phrase that represents what customers might search
              for when looking for your business.
            </p>
          {/if}
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => onClose()}
            class="px-4 py-2 text-sm border border-gray-500"
          >Cancel</Button>
          <Button
            type="submit"
            disabled={loading}
            variant="primary"
            size="md"
            class="px-4 py-2 text-sm"
          >{loading ? 'Adding...' : 'Add Query'}</Button>
        </div>
      </form>
    </div>
  </div>
{/if}
