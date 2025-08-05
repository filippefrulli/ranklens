<script lang="ts">
  import { AuthService } from '../auth'
  
  let email = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state<string | null>(null)
  let mode = $state<'signin' | 'signup'>('signin')
  let showForgotPassword = $state(false)

  async function handleGoogleAuth() {
    error = null
    const result = await AuthService.signInWithGoogle()
    
    if (result.error) {
      error = result.error.message
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
        result = await AuthService.signInWithEmail(email, password)
      } else {
        result = await AuthService.signUpWithEmail(email, password)
      }

      if (result.error) {
        error = result.error.message
      } else if (mode === 'signup') {
        error = null
        // Show success message for signup
        alert('Check your email for a confirmation link!')
      }
    } catch (err) {
      error = 'An unexpected error occurred'
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

    const result = await AuthService.resetPassword(email)
    
    if (result.error) {
      error = result.error.message
    } else {
      alert('Password reset link sent to your email!')
      showForgotPassword = false
    }
    
    loading = false
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-gray-900 mb-2">RankLens</h1>
      <h2 class="text-2xl font-semibold text-gray-800">
        {showForgotPassword ? 'Reset Password' : mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
      </h2>
      <p class="mt-2 text-sm text-gray-600">
        Track your business rankings across all LLMs
      </p>
    </div>

    <div class="bg-white rounded-lg shadow-xl p-8">
      {#if showForgotPassword}
        <!-- Forgot Password Form -->
        <form onsubmit={e => { e.preventDefault(); handleForgotPassword(); }} class="space-y-6">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <button
            type="button"
            onclick={() => showForgotPassword = false}
            class="w-full text-sm text-blue-600 hover:text-blue-800"
          >
            Back to sign in
          </button>
        </form>

      {:else}
        <!-- Google OAuth Button -->
        <button
          onclick={handleGoogleAuth}
          class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-gray-500">Or continue with email</span>
          </div>
        </div>

        <!-- Email/Password Form -->
        <form onsubmit={e => { e.preventDefault(); handleEmailAuth(); }} class="space-y-6">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              bind:value={password}
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>

          <div class="flex items-center justify-between text-sm">
            <button
              type="button"
              onclick={() => showForgotPassword = true}
              class="text-blue-600 hover:text-blue-800"
            >
              Forgot password?
            </button>
            
            <button
              type="button"
              onclick={() => mode = mode === 'signin' ? 'signup' : 'signin'}
              class="text-blue-600 hover:text-blue-800"
            >
              {mode === 'signin' ? 'Create account' : 'Sign in instead'}
            </button>
          </div>
        </form>
      {/if}

      <!-- Error Display -->
      {#if error}
        <div class="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          {error}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="text-center text-sm text-gray-600">
      <p>Secure authentication powered by Supabase</p>
    </div>
  </div>
</div>
