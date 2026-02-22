<script lang="ts">
  import type { SourceCitation } from '$lib/types'

  export let sourceCitations: SourceCitation[] = []

  // Group citations by product_name, target first
  function groupCitations(citations: SourceCitation[]): Array<{
    productName: string
    isTarget: boolean
    sources: SourceCitation[]
  }> {
    const map = new Map<string, { isTarget: boolean; sources: SourceCitation[] }>()
    for (const c of citations) {
      if (!map.has(c.product_name)) {
        map.set(c.product_name, { isTarget: c.is_target, sources: [] })
      }
      map.get(c.product_name)!.sources.push(c)
    }
    return Array.from(map.entries())
      .map(([productName, val]) => ({ productName, ...val }))
      .sort((a, b) => {
        if (a.isTarget && !b.isTarget) return -1
        if (!a.isTarget && b.isTarget) return 1
        return 0
      })
  }

  $: groups = groupCitations(sourceCitations)

  // Collapsed state — tracks which product names are collapsed
  let collapsed = new Set<string>()

  function toggle(productName: string) {
    const next = new Set(collapsed)
    if (next.has(productName)) {
      next.delete(productName)
    } else {
      next.add(productName)
    }
    collapsed = next
  }

  function displayHost(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  }
</script>

<div class="bg-white shadow rounded-lg mt-6 overflow-hidden">
  {#if sourceCitations.length === 0}
    <div class="p-8 text-center">
      <div class="text-gray-300 mb-4">
        <svg class="mx-auto h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </div>
      <p class="text-sm text-gray-500">No sources collected yet.</p>
      <p class="text-xs text-gray-400 mt-1">Run a new analysis to discover which websites influence LLM recommendations.</p>
    </div>
  {:else}
    <div class="divide-y divide-gray-100">
      {#each groups as group}
        {@const isCollapsed = collapsed.has(group.productName)}
        <div>
          <!-- Collapsible header -->
          <button
            type="button"
            class="w-full flex items-center justify-between gap-2 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            onclick={() => toggle(group.productName)}
            aria-expanded={!isCollapsed}
          >
            <div class="flex items-center gap-2 min-w-0">
              <h3 class="text-sm font-semibold truncate {group.isTarget ? 'text-[rgb(var(--color-primary))]' : 'text-gray-900'}">
                {group.productName}
              </h3>
              {#if group.isTarget}
                <span class="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[rgb(var(--color-primary))]/10 text-[rgb(var(--color-primary))]">
                  Your Product
                </span>
              {/if}
              <span class="flex-shrink-0 text-xs text-gray-400">
                {group.sources.length} {group.sources.length === 1 ? 'source' : 'sources'}
              </span>
            </div>
            <svg
              class="flex-shrink-0 w-4 h-4 text-gray-400 transition-transform duration-200 {isCollapsed ? '' : 'rotate-180'}"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Collapsible body -->
          {#if !isCollapsed}
            {@const groupSnippet = group.sources.find(s => s.snippet)?.snippet}
            <div class="px-6 pb-5">
              {#if groupSnippet}
                <p class="text-xs text-gray-500 mb-4 leading-relaxed">{groupSnippet}</p>
              {/if}
              <ul class="space-y-3">
                {#each group.sources as citation}
                  <li class="flex items-start gap-3">
                    <div class="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                    <div class="min-w-0">
                      {#if citation.url}
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline leading-snug"
                        >
                          {citation.title || displayHost(citation.url)}
                        </a>
                        <p class="text-xs text-gray-400 mt-0.5">{displayHost(citation.url)}</p>
                      {:else}
                        <span class="text-sm text-gray-600">{citation.title || 'Unknown source'}</span>
                      {/if}
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="bg-gray-50 px-6 py-3">
      <p class="text-xs text-gray-400">
        Sources discovered via Google Search grounding. Only the target product and competitors ranked above it are shown.
      </p>
    </div>
  {/if}
</div>
