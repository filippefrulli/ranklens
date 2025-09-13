<script lang="ts">
  import UserDropdown from "./UserDropdown.svelte";
  import type { Session } from "@supabase/supabase-js";

  interface Props {
    session: Session | null
  }

  let { session }: Props = $props();
</script>

<header class="bg-white sticky top-0 z-40 shadow-sm border-b">
  <nav class="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
    <div class="flex items-center">
      <a
        href="/"
        class="text-2xl font-bold text-gray-900 hover:text-gray-700 transition-colors cursor-pointer"
      >
        RankLens
      </a>
      
      {#if session}
        <nav class="ml-8 flex space-x-4">
          <a 
            href="/" 
            class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          >
            Dashboard
          </a>
        </nav>
      {/if}
    </div>

    <div class="flex items-center space-x-4">
      {#if session}
        <UserDropdown {session} />
      {:else}
        <a
          href="/signin"
          class="py-2 bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium cursor-pointer"
        >
          Sign In
        </a>
      {/if}
    </div>
  </nav>
</header>
