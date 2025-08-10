<script lang="ts">
  import { onMount } from 'svelte'
  import '../app.css'
  import { AuthService, user, loading as authLoading } from '../lib/services/auth-service'

  onMount(async () => {
    // Initialize authentication when the app loads
    await AuthService.initialize()
  })
</script>

<!-- Loading state while initializing auth -->
{#if $authLoading}
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <h2 class="text-xl font-semibold text-gray-800">Loading RankLens...</h2>
      <p class="text-gray-600 mt-2">Initializing authentication...</p>
    </div>
  </div>
{:else}
  <!-- Main application content -->
  <slot />
{/if}
