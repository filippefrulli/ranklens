<script lang="ts">
  export let onSearchForBusiness: () => void
</script>

<div class="text-center py-12">
  <h2 class="text-2xl font-bold text-gray-900 mb-8">Register Your Business</h2>

  <div class="mb-8">
    <p class="text-gray-600 mb-4">
      To get started, search for your business using Google Maps.
    </p>
  </div>

  <button
    onclick={onSearchForBusiness}
    class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors cursor-pointer"
  >
    Search for Business
  </button>
</div>
