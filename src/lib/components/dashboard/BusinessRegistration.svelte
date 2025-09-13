<script lang="ts">
  export let onSearchForBusiness: () => void
</script>

<section class="py-16">
  <div class="max-w-xl mx-auto px-6 text-center">
    <h1 class="text-4xl font-extrabold tracking-tight text-gray-900">Welcome!</h1>
    <p class="mt-3 text-lg text-gray-600">Let's start by connecting your business.</p>

    <div class="mt-8 flex flex-col items-center gap-3">
      <button
        on:click={onSearchForBusiness}
        class="inline-flex items-center gap-2 bg-black cursor-pointer text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label="Find your business on Google Maps"
      >
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z" clip-rule="evenodd" />
        </svg>
        Find your business
      </button>
    </div>
  </div>
</section>
