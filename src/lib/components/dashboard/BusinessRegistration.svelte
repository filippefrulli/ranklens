<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  export let onSearchForBusiness: () => void
</script>

<section class="relative py-20">
  <div class="max-w-3xl mx-auto px-6">
    <div class="text-center mb-12">
      <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">Welcome to RankLens</h1>
      <p class="mt-4 text-base text-slate-600 max-w-xl mx-auto leading-relaxed">Before we can analyze how AI assistants recommend you, let's connect your business profile. Search for it and we’ll pull structured location & category data.</p>
    </div>

    <Card variant="glass" radius="2xl" padding="p-8">
      <div class="flex flex-col items-center text-center">
        <div class="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm mb-6">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        </div>
        <h2 class="text-lg font-semibold text-slate-800">Connect Your Business</h2>
        <p class="mt-2 text-sm text-slate-600 max-w-md">We’ll use public business data to normalize how LLMs refer to you and to cluster competitors correctly.</p>

        <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="primary" size="md" on:click={onSearchForBusiness} ariaLabel="Find your business via Google Places search">
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z" clip-rule="evenodd" />
            </svg>
            Find your business
          </Button>
          <Button variant="glass" size="md" disabled ariaLabel="Why we need this" title="We use the official listing to standardize naming across AI outputs">Why this step?</Button>
        </div>

        <p class="mt-6 text-[11px] text-slate-500 max-w-sm">Your business data is used only for ranking analysis and never shared externally.</p>
      </div>
    </Card>
  </div>
</section>
