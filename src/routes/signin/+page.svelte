<script lang="ts">
  import type { PageData } from "./$types";
  import LoginForm from "$lib/components/auth/LoginForm.svelte";
  import { createBrowserClient } from "@supabase/ssr";
  import {
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
  } from "$env/static/public";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  // Create browser client for client-side operations
  const supabase = createBrowserClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY
  );

  // Redirect if already authenticated
  onMount(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      goto("/");
    }
  });
</script>

<svelte:head>
  <title>Sign In - RankLens</title>
  <meta
    name="description"
    content="Sign in to your RankLens account to track your business rankings across AI assistants."
  />
</svelte:head>

<div class="mt-8 flex items-center justify-center">
  <div class="max-w-md w-full">
    <div class="bg-white rounded-lg border border-gray-200 p-8">
      <LoginForm {supabase} />
    </div>
  </div>
</div>
