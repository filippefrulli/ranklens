<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
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
  import { PROVIDER_DISPLAY_NAMES, LLMProviderId } from "$lib/constants/llm";
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
      <!-- Hero -->
      <section class="text-center max-w-3xl mx-auto">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 backdrop-blur border border-slate-200 text-[11px] font-medium text-slate-600 shadow-sm mb-6"
        >
          <span
            class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-white text-[10px]"
            >AI</span
          >
          Track how AI mentions you
        </div>
        <h1
          class="text-4xl sm:text-5xl font-semibold leading-tight text-slate-900 tracking-tight"
        >
          See how your business appears<br class="hidden sm:block" /> inside AI recommendations
        </h1>
        <p class="mt-6 text-lg text-slate-600 leading-relaxed">
          RankLens queries leading LLMs and analyzes how often, how high, and
          alongside which competitors your business is recommended for the
          searches that matter.
        </p>
        <div
          class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="/signin"
            class="w-full sm:w-auto inline-flex items-center justify-center bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-primary))] text-white text-sm font-medium px-7 py-3 rounded-lg shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-primary)/0.5)] cursor-pointer transition-colors"
            >Get Started</a
          >
          <a
            href="#features"
            class="w-full sm:w-auto inline-flex items-center justify-center bg-white/80 backdrop-blur text-[rgb(var(--color-primary))] text-sm font-medium px-7 py-3 rounded-lg border border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-primary))]/50 cursor-pointer transition-colors"
            >Learn More</a
          >
        </div>
      </section>

      <!-- Logos / Providers Strip -->
      <section class="mt-20">
        <div
          class="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-80"
        >
          <div class="flex items-center gap-2 text-slate-500 text-sm">
            <span
              class="h-2.5 w-2.5 rounded-full bg-[rgb(var(--color-primary))]"
            ></span>{PROVIDER_DISPLAY_NAMES[LLMProviderId.OPENAI]}
          </div>
          <div class="flex items-center gap-2 text-slate-500 text-sm">
            <span
              class="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700"
            ></span>{PROVIDER_DISPLAY_NAMES[LLMProviderId.GEMINI]}
          </div>
        </div>
      </section>

      <!-- Feature Cards -->
      <section id="features" class="mt-24">
        <div class="grid md:grid-cols-3 gap-6">
          <Card variant="glass" padding="p-6" custom="flex flex-col">
            <div
              class="h-12 w-12 rounded-lg bg-black/5 text-black flex items-center justify-center mb-4"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 19V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2"
                /></svg
              >
            </div>
            <h3 class="text-base font-semibold text-slate-800 mb-2">
              Multi-LLM Coverage
            </h3>
            <p class="text-sm text-slate-600 leading-relaxed flex-1">
              Benchmark visibility across {PROVIDER_DISPLAY_NAMES[
                LLMProviderId.OPENAI
              ]} and {PROVIDER_DISPLAY_NAMES[LLMProviderId.GEMINI]} in one unified
              workflow.
            </p>
          </Card>
          <Card variant="glass" padding="p-6" custom="flex flex-col">
            <div
              class="h-12 w-12 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                /></svg
              >
            </div>
            <h3 class="text-base font-semibold text-slate-800 mb-2">
              Ranking Analytics
            </h3>
            <p class="text-sm text-slate-600 leading-relaxed flex-1">
              See average positions, appearance frequency, provider dispersion
              and momentum over time.
            </p>
          </Card>
          <Card variant="glass" padding="p-6" custom="flex flex-col">
            <div
              class="h-12 w-12 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-4"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6v2m0 0a2 2 0 100 4m0-4a2 2 0 110 4M6 20a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                /></svg
              >
            </div>
            <h3 class="text-base font-semibold text-slate-800 mb-2">
              Smart Query Selection
            </h3>
            <p class="text-sm text-slate-600 leading-relaxed flex-1">
              Get AI-suggested search phrases that surface you (or your
              competitors) most often.
            </p>
          </Card>
        </div>
      </section>

      <!-- How It Works -->
      <section class="mt-28">
        <div
          class="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-10"
        >
          <h2 class="text-2xl font-semibold text-slate-800 text-center mb-10">
            How It Works
          </h2>
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {#each [{ step: 1, title: "Set Up Project", copy: "Define your business profile (name, location, type)." }, { step: 2, title: "Add Queries", copy: "Pick or generate search phrases customers would use." }, { step: 3, title: "Run Analysis", copy: "RankLens queries each provider multiple times for statistical reliability." }, { step: 4, title: "Get Insights", copy: "See rankings, competitor visibility and improvement opportunities." }] as item}
              <div class="text-center">
                <div
                  class="mx-auto mb-4 h-10 w-10 flex items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-white text-sm font-medium"
                >
                  {item.step}
                </div>
                <h3 class="text-sm font-semibold text-slate-700 mb-1">
                  {item.title}
                </h3>
                <p class="text-xs text-slate-500 leading-relaxed">
                  {item.copy}
                </p>
              </div>
            {/each}
          </div>
        </div>
      </section>

      <!-- CTA Band -->
      <section class="mt-24">
        <div
          class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[rgb(var(--color-primary))] to-indigo-600 p-10 text-center shadow-sm"
        >
          <div
            class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_60%)]"
          ></div>
          <h2 class="relative text-2xl font-semibold text-white">
            Start tracking your AI visibility today
          </h2>
          <p class="relative mt-3 text-sm text-white/70 max-w-xl mx-auto">
            Join early adopters measuring how AI assistants recommend businesses
            and capturing competitive advantage.
          </p>
          <div
            class="relative mt-6 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="/signin"
              class="inline-flex items-center justify-center bg-white text-[rgb(var(--color-primary))] text-sm font-medium px-7 py-3 rounded-lg shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white cursor-pointer transition-colors"
              >Create Free Account</a
            >
          </div>
        </div>
      </section>

      <!-- (Removed duplicate footer; global layout Footer handles site-wide copyright) -->
    </div>
  </main>
{/if}
