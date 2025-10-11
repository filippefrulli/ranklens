<script lang="ts">
  import Hero from "$lib/components/landing_page/Hero.svelte";
  import LLMProviders from "$lib/components/landing_page/LLMProviders.svelte";
  import Features from "$lib/components/landing_page/Features.svelte";
  import HowItWorks from "$lib/components/landing_page/HowItWorks.svelte";
  import CTABand from "$lib/components/landing_page/CTABand.svelte";
</script>

<!-- Landing Page -->
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
