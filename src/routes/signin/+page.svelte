<script lang="ts">
  import type { PageData } from "./$types";
  import LoginForm from "$lib/components/auth/LoginForm.svelte";
  import Card from '$lib/components/ui/Card.svelte';
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
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
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

<div class="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 bg-gradient-to-br from-slate-50 to-blue-50">
  <div class="w-full max-w-5xl mx-auto px-4">
    <div class="grid lg:grid-cols-2 gap-10 items-stretch">
      <!-- Auth Card -->
      <Card variant="glass" padding="p-8" custom="flex flex-col justify-center">
        <div class="mb-6">
          <h1 class="text-2xl font-semibold text-slate-800">Welcome back</h1>
          <p class="mt-1 text-sm text-slate-500">Sign in or create an account to track your rankings across AI assistants.</p>
        </div>
        <LoginForm {supabase} />
  <p class="mt-8 text-[11px] text-slate-400">By continuing you agree to our <a href="/terms" class="underline hover:text-slate-600">Terms</a> and <a href="/privacy" class="underline hover:text-slate-600">Privacy Policy</a>.</p>
      </Card>

      <!-- Side Panel / Value Prop -->
      <div class="hidden lg:flex flex-col justify-center relative">
        <div class="absolute -inset-4 rounded-2xl bg-gradient-to-br from-blue-100/60 to-indigo-100/40 border border-blue-200/60"></div>
        <div class="relative p-10 space-y-8">
          <div>
            <h2 class="text-sm font-medium uppercase tracking-wide text-blue-600 mb-3">Why RankLens</h2>
            <p class="text-3xl font-semibold text-slate-800 leading-tight">Understand how AI recommends (or ignores) your business.</p>
          </div>
          <ul class="space-y-5 text-sm text-slate-600">
            <li class="flex items-start gap-3"><span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-medium">1</span><span>Track rankings across OpenAI, Anthropic, Google Gemini & more.</span></li>
            <li class="flex items-start gap-3"><span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-medium">2</span><span>Monitor competitor visibility and discover who dominates queries.</span></li>
            <li class="flex items-start gap-3"><span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] font-medium">3</span><span>Run periodic analyses to see improvement trends.</span></li>
          </ul>
          <div class="pt-4">
            <div class="p-4 rounded-lg bg-white/70 border border-slate-200 shadow-sm">
              <p class="text-sm text-slate-600"><span class="font-medium text-slate-800">New:</span> Query suggestions powered by AI help you discover impactful search phrases instantly.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
