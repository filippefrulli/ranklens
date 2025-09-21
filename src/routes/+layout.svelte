<script lang="ts">
  import { onNavigate, invalidate } from "$app/navigation";
  import { onMount } from "svelte";
  import "../app.css";
  import Footer from "$lib/components/layout/Footer.svelte";
  import Navigation from "$lib/components/layout/Navigation.svelte";
  import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

  let { children, data } = $props<{
    children: any;
    data: {
      session: Session | null;
      user: User | null;
      supabase: SupabaseClient;
    };
  }>();

  let { session, supabase } = $derived(data);

  onNavigate((navigation) => {
    if (!document.startViewTransition) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  onMount(() => {
    // Set up auth state change listener
    const { data: authData } = supabase.auth.onAuthStateChange(
      async (event: string, newSession: Session | null) => {
        // Only proceed if session state actually changed
        if (newSession?.expires_at !== session?.expires_at) {
          // Validate the session by getting the user
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();

          if (!error && user) {
            // Session is valid, invalidate auth cache
            invalidate("supabase:auth");
          } else if (error) {
            // Session is invalid, clear it
            invalidate("supabase:auth");
          }
        }
      }
    );

    // Cleanup auth listener on unmount
    return () => authData.subscription.unsubscribe();
  });
</script>

<svelte:head>
  <title>RankLens</title>
  <meta
    name="description"
    content="Track your business rankings across AI assistants."
  />
</svelte:head>

<a
  href="#main-content"
  class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-white focus:shadow-lg"
  >Skip to content</a
>
<div class="min-h-screen flex flex-col bg-white">
  <Navigation {session} />

  <main id="main-content" class="flex-1">
    {@render children()}
  </main>

  <Footer />
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fade-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-10px);
    }
  }

  ::view-transition-old(root) {
    animation: fade-out 0.2s ease-out;
  }

  ::view-transition-new(root) {
    animation: fade-in 0.3s ease-in;
  }

  main {
    view-transition-name: main-content;
  }
</style>
