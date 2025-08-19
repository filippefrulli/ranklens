<script lang="ts">
  export let query: any
  export let goBack: () => void
</script>

<div class="bg-white shadow rounded-lg p-6 mb-6">
  <div class="flex items-start justify-between">
    <div>
      <button 
        onclick={goBack}
        class="text-blue-600 hover:text-blue-800 font-medium mb-2 inline-flex items-center cursor-pointer"
      >
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Back to Dashboard
      </button>
      <h1 class="text-2xl font-bold text-gray-900">Query Results</h1>
      <p class="text-lg text-gray-700 mt-2">"{query.text}"</p>
      <div class="mt-4 flex items-center space-x-4 text-sm text-gray-500">
        <span>Created: {new Date(query.created_at).toLocaleDateString()}</span>
        <span>•</span>
        <span>Order: #{query.order_index + 1}</span>
      </div>
    </div>
  </div>
</div>
