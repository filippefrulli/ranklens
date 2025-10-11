<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import type { User } from "@supabase/supabase-js";
  import type {
    Business,
    Query,
    QueryRankingHistory,
    WeeklyAnalysisCheck,
    AnalysisRun,
    LLMProvider,
  } from "$lib/types";
  import Dashboard from "../lib/components/dashboard/Dashboard.svelte";
  import Hero from "$lib/components/landing_page/Hero.svelte";
  import LLMProviders from "$lib/components/landing_page/LLMProviders.svelte";
  import Features from "$lib/components/landing_page/Features.svelte";
  import HowItWorks from "$lib/components/landing_page/HowItWorks.svelte";
  import CTABand from "$lib/components/landing_page/CTABand.svelte";

  interface DashboardData {
    user: User | null;
    business?: Business | null;
    queries?: Query[];
    queryHistories?: Record<string, QueryRankingHistory[]>;
    weeklyCheck?: WeeklyAnalysisCheck | null;
    runningAnalysis?: AnalysisRun | null;
    llmProviders?: LLMProvider[];
    needsOnboarding?: boolean;
    error?: string | null;
  }

  interface Props {
    data: PageData & DashboardData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  // Get user from layout data
  const user = $derived(data.user);
</script>

{#if user}
  <!-- Dashboard Application for Authenticated Users -->
  <Dashboard
    {form}
    user={data.user}
    business={data.business ?? null}
    queries={data.queries ?? []}
    queryHistories={data.queryHistories ?? {}}
    weeklyCheck={data.weeklyCheck ?? null}
    runningAnalysis={data.runningAnalysis ?? null}
    llmProviders={data.llmProviders ?? []}
    needsOnboarding={data.needsOnboarding ?? false}
    error={data.error ?? null}
  />
{:else}
  <!-- Landing Page (Unauthenticated) -->
  <main
    class="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-100"
  >
    <!-- Decorative gradient orbs -->
    <div
  class="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-slate-200/40 to-slate-400/30 blur-3xl"
    ></div>
    <div
      class="pointer-events-none absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-indigo-200/40 to-purple-200/40 blur-3xl"
    ></div>

    <div
      class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-24"
    >
      <Hero />
      <LLMProviders />
      <Features />
      <HowItWorks />
      <CTABand />
    </div>
  </main>
{/if}
