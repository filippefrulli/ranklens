<script lang="ts">
  import UserDropdown from "./UserDropdown.svelte";
  import type { Session } from "@supabase/supabase-js";

  let { session } = $props<{ session: Session | null }>();
</script>

<header class="bg-white sticky top-0 z-40">
  <div class="h-px bg-gray-100"></div>
  <nav class="max-w-6xl mx-auto py-4 px-6 flex justify-between items-center">
    <a
      href="/"
      class="text-xl font-bold text-black hover:text-gray-700 transition-colors cursor-pointer"
    >
      Minivent
    </a>

    <div class="flex items-center space-x-4">
      {#if session}
        <a
          href="/events/create"
          class="hidden md:block py-2 bg-black text-white px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium cursor-pointer"
        >
          {("nav.createEvent")}
        </a>

        <UserDropdown {session} />
      {:else}
        <a
          href="/login"
          class="py-2 bg-black text-white px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium cursor-pointer"
        >
          {("nav.login")}
        </a>
      {/if}
    </div>
  </nav>
</header>
