<script lang="ts">
  import { goto } from '$app/navigation'
  import type { SupabaseClient } from '@supabase/supabase-js'
  
  interface Props {
    supabase: SupabaseClient
  }
  
  const { supabase }: Props = $props()
  
  let email = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state<string | null>(null)
  let mode = $state<'signin' | 'signup'>('signin')
  let showForgotPassword = $state(false)

  async function handleGoogleAuth() {
    error = null
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      })
      
      if (error) {
        throw error
      }
    } catch (err: any) {
      error = err?.message || 'Authentication failed'
    }
  }

  async function handleEmailAuth() {
    if (!email || !password) {
      error = 'Email and password are required'
      return
    }

    loading = true
    error = null

    try {
      let result
      if (mode === 'signin') {
        result = await supabase.auth.signInWithPassword({
          email,
          password
        })
      } else {
        result = await supabase.auth.signUp({
          email,
          password
        })
      }

      if (result.error) {
        error = result.error.message || 'Authentication failed'
      } else if (mode === 'signup') {
        error = null
        // Show success message for signup
        alert('Check your email for a confirmation link!')
      } else {
        // Successful sign in, redirect to home (SSR will handle user state)
        goto('/')
      }
    } catch (err: any) {
      error = err?.message || 'An unexpected error occurred'
    } finally {
      loading = false
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      error = 'Please enter your email address'
      return
    }

    loading = true
    error = null

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      
      if (error) {
        throw error
      } else {
        alert('Password reset link sent to your email!')
        showForgotPassword = false
      }
    } catch (err: any) {
      error = err?.message || 'Password reset failed'
    } finally {
      loading = false
    }
  }
</script>

<div class="flex px-4">
  <div class="max-w-sm w-full space-y-8">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900">RankLens</h1>
      <h2 class="mt-6 text-xl text-gray-600">
        {showForgotPassword ? 'Reset Password' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </h2>
    </div>

    <div class="space-y-6">
      {#if showForgotPassword}
        <!-- Forgot Password Form -->
        <form onsubmit={e => { e.preventDefault(); handleForgotPassword(); }} class="space-y-4">
          <div>
            <input
              id="email"
              type="email"
              bind:value={email}
              required
              class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Email address"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>

          <button
            type="button"
            onclick={() => showForgotPassword = false}
            class="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Back to sign in
          </button>
        </form>

      {:else}
        <!-- Google OAuth Button -->
        <button
          onclick={handleGoogleAuth}
          class="w-full flex items-center justify-center px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <svg class="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        <!-- Email/Password Form -->
        <form onsubmit={e => { e.preventDefault(); handleEmailAuth(); }} class="space-y-4">
          <div>
            <input
              id="email"
              type="email"
              bind:value={email}
              required
              class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Email address"
            />
          </div>

          <div>
            <input
              id="password"
              type="password"
              bind:value={password}
              required
              class="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <div class="flex items-center justify-between text-sm text-gray-500">
            <button
              type="button"
              onclick={() => showForgotPassword = true}
              class="hover:text-gray-700"
            >
              Forgot password?
            </button>
            
            <button
              type="button"
              onclick={() => mode = mode === 'signin' ? 'signup' : 'signin'}
              class="hover:text-gray-700"
            >
              {mode === 'signin' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </form>
      {/if}

      <!-- Error Display -->
      {#if error}
        <div class="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
          {error}
        </div>
      {/if}
    </div>
  </div>
</div>
