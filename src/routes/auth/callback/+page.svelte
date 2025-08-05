<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '../../../lib/supabase'

  let loading = $state(true)
  let error = $state<string | null>(null)

  onMount(async () => {
    try {
      // Handle the OAuth callback
      const { data, error: authError } = await supabase.auth.getSession()
      
      if (authError) {
        console.error('Auth callback error:', authError)
        error = authError.message
        return
      }

      if (data.session) {
        // Successfully authenticated, redirect to dashboard
        window.location.href = '/'
      } else {
        // No session found, redirect to login
        window.location.href = '/auth/login'
      }
    } catch (err) {
      console.error('Callback processing error:', err)
      error = 'Authentication failed. Please try again.'
    } finally {
      loading = false
    }
  })
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
  <div class="text-center">
    {#if loading}
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <h2 class="text-xl font-semibold text-gray-800">Completing sign in...</h2>
      <p class="text-gray-600 mt-2">Please wait while we redirect you.</p>
    {:else if error}
      <div class="bg-white rounded-lg shadow-xl p-8 max-w-md">
        <div class="text-red-600 mb-4">
          <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-800 mb-2">Authentication Failed</h2>
        <p class="text-gray-600 mb-4">{error}</p>
        <a 
          href="/auth/login" 
          class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
        >
          Try Again
        </a>
      </div>
    {/if}
  </div>
</div>
