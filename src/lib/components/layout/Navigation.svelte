<script lang="ts">
  import UserDropdown from "./UserDropdown.svelte";
  import type { Session } from "@supabase/supabase-js";

  interface Props {
    session: Session | null
  }

  let { session }: Props = $props();

  // Mobile navigation state (Svelte 5 runes)
  let mobileOpen = $state(false)
  function toggle() { mobileOpen = !mobileOpen }
  function close() { mobileOpen = false }
</script>

<header class="sticky top-0 z-40 backdrop-blur bg-white/70 supports-[backdrop-filter]:bg-white/60 border-b border-slate-200/70">
  <nav class="max-w-7xl mx-auto h-12 px-3 sm:px-5 lg:px-6 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <a href="/" class="group inline-flex items-center gap-1.5 font-semibold text-slate-800 tracking-tight text-[15px] cursor-pointer">
  <span class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[rgb(var(--color-primary))] to-indigo-600 text-white font-bold text-xs shadow-sm">RL</span>
        <span class="group-hover:text-slate-900 transition-colors leading-none">RankLens</span>
      </a>
    </div>
    <div class="flex items-center gap-3">
      {#if session}
        <div class="hidden sm:block">
          <UserDropdown {session} />
        </div>
  <button class="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary)/0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-white cursor-pointer" onclick={toggle} aria-label="Toggle navigation" aria-expanded={mobileOpen} aria-controls="mobile-nav">
          {#if mobileOpen}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          {/if}
        </button>
      {:else}
  <a href="/signin" class="hidden sm:inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-[rgb(var(--color-primary))] text-white text-xs font-medium shadow-sm hover:bg-[rgb(var(--color-primary))] transition-colors cursor-pointer">Sign In</a>
  <a href="/signin" class="sm:hidden inline-flex items-center justify-center h-8 w-8 rounded-md bg-[rgb(var(--color-primary))] text-white font-medium shadow-sm hover:bg-[rgb(var(--color-primary))] cursor-pointer" aria-label="Sign in">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
        <button class="md:hidden hidden" aria-hidden="true"></button>
      {/if}
    </div>
  </nav>

  <!-- Mobile panel -->
  {#if mobileOpen}
    <div id="mobile-nav" class="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm" role="navigation" aria-label="Mobile navigation">
      <div class="px-3 py-3">
        {#if session}
          <UserDropdown {session} />
        {:else}
          <a href="/signin" class="inline-flex w-full items-center justify-center px-3 py-2 rounded-md bg-[rgb(var(--color-primary))] text-white text-xs font-medium shadow-sm hover:bg-[rgb(var(--color-primary))] cursor-pointer" onclick={close}>Sign In</a>
        {/if}
      </div>
    </div>
  {/if}
</header>
