<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import type { Company, Product } from "$lib/types";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import BusinessRegistration from "$lib/components/dashboard/BusinessRegistration.svelte";
  import GoogleBusinessSearch from "$lib/components/business/GoogleBusinessSearch.svelte";
  import CreateBusinessModal from "$lib/components/dashboard/CreateBusinessModal.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";

  interface Props {
    data: PageData & {
      company?: Company;
      products?: Product[];
      needsOnboarding?: boolean;
    };
    form: ActionData;
  }

  let { data, form }: Props = $props();

  let company = $derived(data.company ?? null);
  let products = $derived(data.products ?? []);
  let needsOnboarding = $derived(data.needsOnboarding ?? false);

  // New product form
  let showAddProduct = $state(false);
  let newProductName = $state("");
  let newProductDescription = $state("");
  let loading = $state(false);

  // Onboarding state
  let showGoogleSearch = $state(false);
  let showCreateBusiness = $state(false);
  let newCompany = $state({
    name: "",
    google_place_id: "",
    city: "",
    google_primary_type: "",
    google_primary_type_display: "",
    google_types: [] as string[],
  });

  function handleBusinessSelected(selectedBusiness: any) {
    newCompany = {
      name: selectedBusiness.name,
      google_place_id: selectedBusiness.google_place_id,
      city: selectedBusiness.city,
      google_primary_type: selectedBusiness.google_primary_type || "",
      google_primary_type_display: selectedBusiness.google_primary_type_display || "",
      google_types: selectedBusiness.google_types || [],
    };
    showGoogleSearch = false;
    showCreateBusiness = true;
  }
</script>

{#if needsOnboarding || !company}
  <!-- Onboarding: create company first -->
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <BusinessRegistration onSearchForBusiness={() => (showGoogleSearch = true)} />
    </main>

    {#if showGoogleSearch}
      <div class="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">Find Your Company</h3>
              <button onclick={() => (showGoogleSearch = false)} class="text-gray-400 hover:text-gray-600 cursor-pointer" aria-label="Close">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <GoogleBusinessSearch onBusinessSelected={handleBusinessSelected} />
          </div>
        </div>
      </div>
    {/if}

    {#if showCreateBusiness}
      <CreateBusinessModal
        show={showCreateBusiness}
        {loading}
        business={newCompany}
        onBackToSearch={() => { showCreateBusiness = false; showGoogleSearch = true; }}
      />
    {/if}
  </div>
{:else}
  <!-- Products page -->
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
    <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Products</h1>
          <p class="text-sm text-slate-500 mt-1">{company.name}</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => (showAddProduct = true)}
        >+ Add Product</Button>
      </div>

      <!-- Product Grid -->
      {#if products.length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {#each products as product (product.id)}
            <a
              href="/product/{product.id}"
              class="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-[rgb(var(--color-primary))] transition-all cursor-pointer"
            >
              <div class="flex items-start gap-4">
                <div class="flex-shrink-0 h-12 w-12 rounded-lg bg-gradient-to-br from-[rgb(var(--color-primary))]/10 to-indigo-100 flex items-center justify-center">
                  <span class="text-lg font-bold text-[rgb(var(--color-primary))]">{product.name[0]?.toUpperCase() || 'P'}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-base font-semibold text-slate-900 truncate">{product.name}</h3>
                  {#if product.description}
                    <p class="text-sm text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                  {:else}
                    <p class="text-sm text-slate-400 mt-1 italic">No description</p>
                  {/if}
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span class="text-xs text-slate-400">Created {new Date(product.created_at).toLocaleDateString()}</span>
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <Card padding="p-12" custom="text-center">
          <div class="mx-auto h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-5">
            <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-800">No products yet</h3>
          <p class="text-sm text-slate-500 mt-2 max-w-sm mx-auto">Add a product to start tracking how it ranks across AI assistants.</p>
          <div class="mt-6">
            <Button variant="primary" size="md" onClick={() => (showAddProduct = true)}>+ Add Your First Product</Button>
          </div>
        </Card>
      {/if}
    </main>
  </div>

  <!-- Add Product Modal -->
  {#if showAddProduct}
    <div class="fixed inset-0 bg-gray-600/50 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div class="p-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-semibold text-slate-900">Add Product</h3>
            <button onclick={() => { showAddProduct = false; newProductName = ''; newProductDescription = ''; }} class="text-gray-400 hover:text-gray-600 cursor-pointer" aria-label="Close">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <form method="POST" action="?/createProduct"
            use:enhance={() => {
              loading = true;
              return async ({ result }) => {
                loading = false;
                if (result.type === 'success') {
                  showAddProduct = false;
                  newProductName = '';
                  newProductDescription = '';
                  await invalidateAll();
                }
              };
            }}
          >
            <div class="space-y-4">
              <div>
                <label for="product-name" class="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  id="product-name"
                  type="text"
                  name="name"
                  bind:value={newProductName}
                  required
                  class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50 text-sm"
                  placeholder="e.g. iPhone, Website Builder"
                />
              </div>
              <div>
                <label for="product-desc" class="block text-sm font-medium text-slate-700 mb-1">Description <span class="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  id="product-desc"
                  name="description"
                  bind:value={newProductDescription}
                  rows="2"
                  class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50 text-sm"
                  placeholder="Brief description to help AI understand your product"
                ></textarea>
              </div>
              <div class="flex justify-end gap-3 pt-2">
                <Button variant="subtle" size="md" onClick={() => { showAddProduct = false; newProductName = ''; newProductDescription = ''; }}>Cancel</Button>
                <Button type="submit" variant="primary" size="md" disabled={loading || !newProductName.trim()}>
                  {loading ? 'Creating…' : 'Create Product'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}
{/if}
