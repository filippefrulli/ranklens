<script lang="ts">
  import type { PageData } from "./$types";
  import LoginForm from "$lib/components/auth/LoginForm.svelte";
  import Card from "$lib/components/ui/Card.svelte";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { PROVIDER_DISPLAY_NAMES, LLMProviderId } from "$lib/constants/llm";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  // Use supabase client from layout
  const supabase = data.supabase;

  // Redirect if already authenticated
  onMount(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      goto("/dashboard");
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

<div
  class="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 bg-gradient-to-br from-slate-50 to-slate-100"
>
  <div class="w-full max-w-5xl mx-auto px-4">
    <div class="grid lg:grid-cols-2 gap-10 items-stretch">
      <!-- Auth Card -->
      <Card variant="glass" padding="p-8" custom="flex flex-col justify-center">
        <LoginForm {supabase} />
      </Card>

      <!-- Side Panel / Value Prop -->
      <div class="hidden lg:flex flex-col justify-center relative">
        <div
          class="absolute -inset-4 rounded-2xl bg-gradient-to-br from-slate-100/60 to-slate-300/40 border border-slate-200/60"
        ></div>
        <div class="relative p-10 space-y-8">
          <div>
            <h2
              class="text-sm font-medium uppercase tracking-wide text-[rgb(var(--color-primary))] mb-3"
            >
              Why RankLens
            </h2>
            <p class="text-3xl font-semibold text-slate-800 leading-tight">
              Understand how AI recommends (or ignores) your business.
            </p>
          </div>
          <ul class="space-y-5 text-sm text-slate-600">
            <li class="flex items-start gap-3">
              <span
                class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-white text-[11px] font-medium"
                >1</span
              ><span
                >Track rankings across {PROVIDER_DISPLAY_NAMES[
                  LLMProviderId.OPENAI
                ]} and {PROVIDER_DISPLAY_NAMES[LLMProviderId.GEMINI]}.</span
              >
            </li>
            <li class="flex items-start gap-3">
              <span
                class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-white text-[11px] font-medium"
                >2</span
              ><span
                >Monitor competitor visibility and discover who dominates
                queries.</span
              >
            </li>
            <li class="flex items-start gap-3">
              <span
                class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-white text-[11px] font-medium"
                >3</span
              ><span>Run periodic analyses to see improvement trends.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
