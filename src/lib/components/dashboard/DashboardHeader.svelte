<script lang="ts">
  import type { User } from '@supabase/supabase-js'
  
  export let user: User | null
  export let onSignOut: () => Promise<void>
</script>

<header class="bg-white shadow-sm border-b">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <div class="flex items-center">
        <h1 class="text-2xl font-bold text-gray-900">RankLens</h1>
      </div>

      {#if user}
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-600">{user.email}</span>
          <button
            onclick={onSignOut}
            class="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      {/if}
    </div>
  </div>
</header>
