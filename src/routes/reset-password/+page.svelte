<script lang="ts">
  import { onMount } from "svelte";
  import { goto, replaceState } from "$app/navigation";
  import { createBrowserClient } from "@supabase/ssr";
  import {
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
  } from "$env/static/public";

  let newPassword = $state("");
  let confirmPassword = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  let hasRecoverySession = $state(false);
  let sessionLoading = $state(true);



  const supabase = createBrowserClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY
  );

  // Live validation helpers
  const newTrim = $derived(newPassword?.trim?.() ?? "");
  const confirmTrim = $derived(confirmPassword?.trim?.() ?? "");
  const tooShort = $derived(newTrim.length < 10);
  const mismatch = $derived(confirmTrim.length > 0 && newTrim !== confirmTrim);
  const passwordsEmpty = $derived(newTrim.length === 0 || confirmTrim.length === 0);

  onMount(() => {
    // Set up auth state listener first
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        hasRecoverySession = true;
      }
    });

    // Handle session recovery asynchronously
    (async () => {
      // Ensure we have a valid session for recovery. Depending on the email link, Supabase may
      // use PKCE (code in query) or tokens in the hash. Handle both, then check for a session.
      try {
        const url = new URL(window.location.href);
        const qs = url.searchParams;
        const hashParams = new URLSearchParams(url.hash?.startsWith('#') ? url.hash.slice(1) : url.hash);

        const code = qs.get('code') || hashParams.get('code');
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');

        let authError = null;

        if (code) {
          // PKCE flow: exchange code for a session
          const result = await withTimeout(supabase.auth.exchangeCodeForSession(code), 15000);
          const exchangeError = (result as any)?.error;
          if (exchangeError) {
            authError = exchangeError;
            // Check for specific error types
            if (exchangeError.message?.includes('invalid_grant') || exchangeError.message?.includes('expired')) {
              error = "This password reset link has expired or has already been used. Please request a new password reset.";
            } else if (exchangeError.message?.includes('invalid_request')) {
              error = "Invalid password reset link. Please request a new password reset.";
            }
          }
        } else if (access_token && refresh_token) {
          // Hash tokens flow: explicitly set the session if provided
          const sessionResult = await withTimeout(
            supabase.auth.setSession({ access_token, refresh_token }),
            15000
          );
          const sessionError = (sessionResult as any)?.error;
          if (sessionError) {
            authError = sessionError;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        hasRecoverySession = Boolean(session);
        
        // If we don't have a session and encountered an auth error, show user-friendly message
        if (!hasRecoverySession && !error) {
          if (authError) {
            error = "Unable to verify your password reset request. Please try requesting a new password reset.";
          } else if (!code && !access_token) {
            error = "This page requires a valid password reset link. Please check your email and click the reset link.";
          }
        }

        // Clean the URL to remove code/hash tokens after we have a session
        try {
          replaceState('/reset-password', {});
        } catch {}
      } catch (e) {
        hasRecoverySession = false;
        if (!error) {
          error = "Failed to process password reset link. Please try again or request a new reset link.";
        }
      } finally {
        sessionLoading = false;
      }
    })();

    // Return cleanup function synchronously
    return () => {
      sub?.subscription?.unsubscribe();
    };
  });

  function mapSupabaseErrorMessage(e: any): string {
    const msg = (e?.message || "").toString().toLowerCase();
    if (msg.includes("same") && msg.includes("password")) {
      return "Your new password must be different from the current password.";
    }
    if (
      msg.includes("password") &&
      (msg.includes("short") || msg.includes("at least"))
    ) {
      return "Password is too short. Please use at least 10 characters.";
    }
    if (
      msg.includes("expired") ||
      msg.includes("invalid") ||
      msg.includes("session")
    ) {
      return "This reset link is invalid or expired. Please request a new password reset email.";
    }
    if (msg.includes("rate") && msg.includes("limit")) {
      return "Too many attempts. Please wait a moment and try again.";
    }
    return e?.message || "Failed to update password. Please try again.";
  }

  function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(
        () =>
          reject(
            new Error("Request timed out. Check your connection and try again.")
          ),
        ms
      );
      p.then((v) => {
        clearTimeout(t);
        resolve(v);
      }).catch((e) => {
        clearTimeout(t);
        reject(e);
      });
    });
  }

  async function updatePassword() {
    error = null;
    success = false;

    const trimmed = newPassword?.trim() ?? "";
    
    if (!trimmed || trimmed.length < 10) {
      error = "Password must be at least 10 characters.";
      return;
    }
    if (trimmed !== (confirmPassword?.trim() ?? "")) {
      error = "Passwords do not match.";
      return;
    }

    loading = true;
    
    try {
      const response = await fetch('/api/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: trimmed })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Password update failed');
      }

      success = true;
      
    } catch (e: any) {
      error = mapSupabaseErrorMessage(e);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Reset Password - RankLens</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main
  class="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 bg-gradient-to-br from-slate-50 to-slate-100"
>
  <div class="w-full max-w-md mx-auto px-4">
    <div
      class="bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm p-6"
    >
      <h1 class="text-xl font-semibold text-slate-800 mb-1">
        Set a new password
      </h1>
      <p class="text-sm text-slate-600 mb-6">
        {#if sessionLoading}
          Verifying your password reset request...
        {:else if hasRecoverySession}
          Enter a new password for your account.
        {:else}
          This page requires a valid password reset link from your email.
        {/if}
      </p>

      {#if !sessionLoading}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          updatePassword();
        }}
        class="space-y-4"
      >
        <!-- Hidden username field for accessibility -->
        <input
          type="text"
          name="username"
          autocomplete="username"
          style="display: none;"
          readonly
          tabindex="-1"
          aria-hidden="true"
        />
        <div>
          <label
            class="block text-sm font-medium text-slate-700 mb-1"
            for="new-password">New password</label
          >
          <input
            id="new-password"
            type="password"
            bind:value={newPassword}
            autocomplete="new-password"
            minlength={10}
            required
            class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50 focus:border-transparent"
            class:border-red-300={tooShort}
            aria-invalid={tooShort}
          />
          <div class="mt-1 flex items-center justify-between">
            <p class="text-xs text-slate-500">Minimum 10 characters</p>
            {#if tooShort}
              <p class="text-xs text-red-600">Password is too short</p>
            {/if}
          </div>
        </div>
        <div>
          <label
            class="block text-sm font-medium text-slate-700 mb-1"
            for="confirm-password">Confirm password</label
          >
          <input
            id="confirm-password"
            type="password"
            bind:value={confirmPassword}
            autocomplete="new-password"
            minlength={10}
            required
            class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50 focus:border-transparent"
            class:border-red-300={mismatch}
            aria-invalid={mismatch}
          />
          {#if confirmTrim.length > 0}
            <div class="mt-1">
              {#if mismatch}
                <p class="text-xs text-red-600">Passwords do not match</p>
              {/if}
            </div>
          {/if}
        </div>

        {#if error}
          <div
            class="p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm"
          >
            {error}
            {#if !hasRecoverySession && !sessionLoading}
              <div class="mt-2">
                <a 
                  href="/signin?tab=reset" 
                  class="text-red-800 underline hover:no-underline cursor-pointer"
                >
                  Request a new password reset
                </a>
              </div>
            {/if}
          </div>
        {/if}
        {#if success}
          <div
            class="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm text-center"
          >
            <div class="flex items-center justify-center gap-2 mb-3">
              <svg class="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span class="font-medium">Password updated successfully!</span>
            </div>
            <a 
              href="/" 
              class="inline-block w-full bg-emerald-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-emerald-700 cursor-pointer transition-colors"
            >
              Continue to Dashboard
            </a>
          </div>
        {/if}

        {#if !success}
        <button
          type="submit"
          disabled={sessionLoading || !hasRecoverySession || loading || tooShort || mismatch || passwordsEmpty}
          class="w-full bg-[rgb(var(--color-primary))] hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
        >
          {#if sessionLoading}
            Verifying link...
          {:else if loading}
            Updating password...
          {:else}
            Update password
          {/if}
        </button>
        {/if}
      </form>
      {:else}
      <!-- Loading state while verifying session -->
      <div class="space-y-4">
        <div class="animate-pulse">
          <div class="h-4 bg-slate-200 rounded w-24 mb-2"></div>
          <div class="h-10 bg-slate-200 rounded"></div>
        </div>
        <div class="animate-pulse">
          <div class="h-4 bg-slate-200 rounded w-32 mb-2"></div>
          <div class="h-10 bg-slate-200 rounded"></div>
        </div>
        <div class="h-10 bg-slate-200 rounded animate-pulse"></div>
      </div>
      {/if}
    </div>
  </div>
</main>
