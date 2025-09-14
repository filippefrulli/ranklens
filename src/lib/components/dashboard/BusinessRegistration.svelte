<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  export let onSearchForBusiness: () => void;
</script>

<section class="relative py-14">
  <div class="max-w-xl mx-auto px-6">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-semibold tracking-tight text-slate-900">Connect your business</h1>
      <p class="mt-3 text-sm text-slate-600 leading-relaxed">
        Search and select your business
      </p>
    </div>

    <Card variant="glass" radius="2xl" padding="p-6">
      <div class="flex flex-col items-center text-center">
        <div class="mt-6">
          <Button
            variant="primary"
            size="md"
            on:click={onSearchForBusiness}
            ariaLabel="Find your business via Google Places search"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z" clip-rule="evenodd" />
            </svg>
            <span class="ml-2">Find your business</span>
          </Button>
        </div>
        <p class="mt-4 text-[11px] text-slate-400">Can’t find it? You’ll be able to add it manually next.</p>
      </div>
    </Card>
  </div>
</section>
