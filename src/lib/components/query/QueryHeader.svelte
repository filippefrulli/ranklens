<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import LLMLogo from "$lib/components/logos/LLMLogo.svelte";
  import type { LLMProvider } from "$lib/types";

  interface Props {
    queryText: string
    llmProviders: LLMProvider[]
    selectedProvider: LLMProvider | null
    onBack: () => void
    onProviderChange: (provider: LLMProvider | null) => void
  }

  let { 
    queryText, 
    llmProviders, 
    selectedProvider, 
    onBack, 
    onProviderChange 
  }: Props = $props();
</script>

<div class="flex items-start justify-between flex-col md:flex-row gap-4">
  <div>
    <div class="flex items-center gap-3">
      <Button
        variant="subtle"
        size="md"
        onClick={onBack}
        class="text-slate-600 hover:text-slate-800 border border-slate-300 bg-white px-4 py-2 text-sm rounded-md"
      >← Back</Button>
      <h1 class="text-xl font-semibold text-slate-800">
        Query: <span class="text-slate-900">{queryText}</span>
      </h1>
    </div>
  </div>
  
  <!-- Provider Pills -->
  <div class="flex flex-wrap items-center gap-2">
    <Button
      variant="subtle"
      size="sm"
      onClick={() => onProviderChange(null)}
      class="px-3.5 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-2 {selectedProvider === null ? 'bg-[rgb(var(--color-primary))] text-slate-900 !border-[rgb(var(--color-primary))]' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}"
    >
      <LLMLogo provider="all" size={20} alt="All providers" />
      <span>All</span>
    </Button>
    {#each llmProviders as provider}
      <Button
        variant="subtle"
        size="sm"
        onClick={() => onProviderChange(provider)}
        class="px-3.5 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-2 {selectedProvider?.id === provider.id ? 'bg-[rgb(var(--color-primary))] text-slate-900 !border-[rgb(var(--color-primary))]' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}"
      >
        <LLMLogo provider={provider.name} size={20} alt={provider.name} />
        <span>{provider.name}</span>
      </Button>
    {/each}
  </div>
</div>
