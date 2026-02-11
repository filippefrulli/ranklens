<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import type { Product, Company, Measurement } from "$lib/types";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";

  interface Props {
    data: PageData & {
      product: Product;
      company?: Company | null;
      measurements: Measurement[];
      measurementSummaries?: Record<string, { lastRunAt: string | null, averageRank: number | null }>;
    };
    form: ActionData;
  }

  let { data, form }: Props = $props();

  let product = $derived(data.product);
  let company = $derived(data.company);
  let measurements = $derived(data.measurements ?? []);
  let summaries = $derived(data.measurementSummaries ?? {});

  function formatRelativeDate(d: string): string {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Modal states
  let showAddMeasurement = $state(false);
  let newTitle = $state("");
  let newQuery = $state("");
  let loading = $state(false);

  // 3-dot menu state
  let openMenuId = $state<string | null>(null);

  function toggleMenu(id: string) {
    openMenuId = openMenuId === id ? null : id;
  }

  // Close menu on click outside
  function handleClickOutside() {
    if (openMenuId) openMenuId = null;
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
  <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <a href="/dashboard" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" aria-label="Back to products">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </a>
          <h1 class="text-2xl font-semibold text-slate-900">{product.name}</h1>
        </div>
        {#if company}
          <p class="text-sm text-slate-500 ml-8">{company.name}</p>
        {/if}
      </div>
      <div class="flex items-center gap-3">
        <Button variant="primary" size="md" onClick={() => (showAddMeasurement = true)}>+ Add Measurement</Button>
      </div>
    </div>

    <!-- Measurements Grid: Two Columns -->
    {#if measurements.length > 0}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each measurements as measurement (measurement.id)}
          <a
            href="/measurement/{measurement.id}"
            class="group relative block rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-[rgb(var(--color-primary))] transition-all cursor-pointer"
          >
            <!-- 3-dot menu -->
            <div class="absolute top-4 right-4">
              <button
                type="button"
                onclick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(measurement.id); }}
                class="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Measurement options"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" /></svg>
              </button>

              {#if openMenuId === measurement.id}
                <div class="absolute right-0 top-8 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                  <form method="POST" action="?/deleteMeasurement"
                    use:enhance={() => {
                      return async () => { await invalidateAll(); };
                    }}
                  >
                    <input type="hidden" name="measurementId" value={measurement.id} />
                    <button
                      type="submit"
                      onclick={(e) => e.stopPropagation()}
                      class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer flex items-center gap-2"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  </form>
                </div>
              {/if}
            </div>

            <div class="pr-8">
              <h3 class="text-sm font-semibold text-slate-800 transition-colors">{measurement.title}</h3>
              <p class="text-sm text-slate-500 mt-1.5 line-clamp-2">{measurement.query}</p>
              {#if summaries[measurement.id]}
                <div class="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                  {#if summaries[measurement.id].averageRank != null}
                    <span class="inline-flex items-center gap-1 text-xs font-medium {summaries[measurement.id].averageRank! <= 3 ? 'text-green-700' : summaries[measurement.id].averageRank! <= 10 ? 'text-yellow-700' : 'text-red-700'}">
                      <span class="inline-flex px-1.5 py-0.5 rounded-md {summaries[measurement.id].averageRank! <= 3 ? 'bg-green-100' : summaries[measurement.id].averageRank! <= 10 ? 'bg-yellow-100' : 'bg-red-100'}">#{summaries[measurement.id].averageRank}</span>
                      avg rank
                    </span>
                  {:else}
                    <span class="text-xs text-slate-400">No rank data</span>
                  {/if}
                  {#if summaries[measurement.id].lastRunAt}
                    <span class="text-xs text-slate-400">· {formatRelativeDate(summaries[measurement.id].lastRunAt!)}</span>
                  {/if}
                </div>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <Card padding="p-12" custom="text-center">
        <div class="mx-auto h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-5">
          <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
        </div>
        <h3 class="text-lg font-semibold text-slate-800">No measurements yet</h3>
        <p class="text-sm text-slate-500 mt-2 max-w-sm mx-auto">Add search queries that customers might use to find your product.</p>
        <div class="mt-6">
          <Button variant="primary" size="md" onClick={() => (showAddMeasurement = true)}>+ Add Your First Measurement</Button>
        </div>
      </Card>
    {/if}
  </main>
</div>

<!-- Add Measurement Modal -->
{#if showAddMeasurement}
  <div class="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50">
    <div class="bg-white rounded-xl shadow-xl max-w-md w-full">
      <div class="p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-semibold text-slate-900">Add Measurement</h3>
          <button onclick={() => { showAddMeasurement = false; newTitle = ''; newQuery = ''; }} class="text-gray-400 hover:text-gray-600 cursor-pointer" aria-label="Close">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form method="POST" action="?/addMeasurement"
          use:enhance={() => {
            loading = true;
            return async ({ result }) => {
              loading = false;
              if (result.type === 'success') {
                showAddMeasurement = false;
                newTitle = '';
                newQuery = '';
                await invalidateAll();
              }
            };
          }}
        >
          <div class="space-y-4">
            <div>
              <label for="m-title" class="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input id="m-title" type="text" name="title" bind:value={newTitle} required
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50 text-sm"
                placeholder="Short label for this measurement"
              />
            </div>
            <div>
              <label for="m-query" class="block text-sm font-medium text-slate-700 mb-1">Query</label>
              <textarea id="m-query" name="query" bind:value={newQuery} required rows="3"
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50 text-sm"
                placeholder="The search phrase sent to LLMs, e.g. 'Best project management tools'"
              ></textarea>
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <Button variant="subtle" size="md" onClick={() => { showAddMeasurement = false; newTitle = ''; newQuery = ''; }}>Cancel</Button>
              <Button type="submit" variant="primary" size="md" disabled={loading || !newTitle.trim() || !newQuery.trim()}>
                {loading ? 'Adding…' : 'Add Measurement'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}
