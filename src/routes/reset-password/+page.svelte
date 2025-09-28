<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { createBrowserClient } from '@supabase/ssr'
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

  const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

  let newPassword = $state('')
  let confirmPassword = $state('')
  let loading = $state(false)
  let error = $state<string | null>(null)
  let success = $state(false)
  let hasRecoverySession = $state(false)

  // Live validation helpers
  const newTrim = $derived((newPassword?.trim?.() ?? ''))
  const confirmTrim = $derived((confirmPassword?.trim?.() ?? ''))
  const tooShort = $derived(newTrim.length > 0 && newTrim.length < 10)
  const mismatch = $derived(confirmTrim.length > 0 && newTrim !== confirmTrim)

  onMount(async () => {
    // Detect if we have a recovery session. The client auto-detects tokens in URL.
    const { data: { session } } = await supabase.auth.getSession()
    hasRecoverySession = Boolean(session)
  })

  function mapSupabaseErrorMessage(e: any): string {
    const msg = (e?.message || '').toString().toLowerCase()
    if (msg.includes('same') && msg.includes('password')) {
      return 'Your new password must be different from the current password.'
    }
    if (msg.includes('password') && (msg.includes('short') || msg.includes('at least'))) {
      return 'Password is too short. Please use at least 10 characters.'
    }
    if (msg.includes('expired') || msg.includes('invalid') || msg.includes('session')) {
      return 'This reset link is invalid or expired. Please request a new password reset email.'
    }
    if (msg.includes('rate') && msg.includes('limit')) {
      return 'Too many attempts. Please wait a moment and try again.'
    }
    return e?.message || 'Failed to update password. Please try again.'
  }

  function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Request timed out. Check your connection and try again.')), ms)
      p.then((v) => { clearTimeout(t); resolve(v) }).catch((e) => { clearTimeout(t); reject(e) })
    })
  }

  async function updatePassword() {
    error = null
    success = false

    const trimmed = newPassword?.trim() ?? ''
    if (!trimmed || trimmed.length < 10) {
      error = 'Password must be at least 10 characters.'
      return
    }
    if (trimmed !== (confirmPassword?.trim() ?? '')) {
      error = 'Passwords do not match.'
      return
    }

    loading = true
    try {
      const { error: updateError } = await withTimeout(supabase.auth.updateUser({ password: trimmed }))
      if (updateError) throw updateError

      success = true
      // Give the UI a moment to show success, then go to sign in or home
      setTimeout(() => goto('/signin', { replaceState: true }), 1000)
    } catch (e: any) {
      error = mapSupabaseErrorMessage(e)
    } finally {
      loading = false
    }
  }
</script>

<svelte:head>
  <title>Reset Password - RankLens</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 bg-gradient-to-br from-slate-50 to-slate-100">
  <div class="w-full max-w-md mx-auto px-4">
    <div class="bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm p-6">
      <h1 class="text-xl font-semibold text-slate-800 mb-1">Set a new password</h1>
      <p class="text-sm text-slate-600 mb-6">
        {#if hasRecoverySession}
          Enter a new password for your account.
        {:else}
          This page is intended to be opened from the reset link in your email.
          Please re-open the link from your inbox to continue.
        {/if}
      </p>

      <form onsubmit={(e) => { e.preventDefault(); updatePassword(); }} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1" for="new-password">New password</label>
          <input id="new-password" type="password" bind:value={newPassword} minlength={10} required class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50 focus:border-transparent" class:border-red-300={tooShort} aria-invalid={tooShort} />
          <div class="mt-1 flex items-center justify-between">
            <p class="text-xs text-slate-500">Minimum 10 characters</p>
            {#if tooShort}
              <p class="text-xs text-red-600">Password is too short</p>
            {/if}
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1" for="confirm-password">Confirm password</label>
          <input id="confirm-password" type="password" bind:value={confirmPassword} minlength={10} required class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50 focus:border-transparent" class:border-red-300={mismatch} aria-invalid={mismatch} />
          {#if confirmTrim.length > 0}
            <div class="mt-1">
              {#if mismatch}
                <p class="text-xs text-red-600">Passwords do not match</p>
              {/if}
            </div>
          {/if}
        </div>

        {#if error}
          <div class="p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
        {/if}
        {#if success}
          <div class="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">Password updated. Redirecting…</div>
        {/if}

        <button type="submit" disabled={!hasRecoverySession || loading || tooShort || mismatch} class="w-full bg-[rgb(var(--color-primary))] hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors cursor-pointer">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  </div>
  
</main>
