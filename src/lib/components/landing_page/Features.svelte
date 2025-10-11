<script lang="ts">
  import { PROVIDER_DISPLAY_NAMES, LLMProviderId } from "$lib/constants/llm";
  import FeatureCard from './FeatureCard.svelte';

  const features = [
    {
      iconName: 'globe-alt',
      iconBgClass: 'bg-black/5',
      iconTextClass: 'text-black',
      title: 'Multi-LLM Coverage',
      description: `Benchmark visibility across ${PROVIDER_DISPLAY_NAMES[LLMProviderId.OPENAI]} and ${PROVIDER_DISPLAY_NAMES[LLMProviderId.GEMINI]} in one unified workflow.`,
      ariaLabel: 'Global LLM coverage'
    },
    {
      iconName: 'chart-bar',
      iconBgClass: 'bg-emerald-100',
      iconTextClass: 'text-emerald-600',
      title: 'Ranking Analytics',
      description: 'See average positions, appearance frequency, provider dispersion and momentum over time.',
      ariaLabel: 'Ranking analytics'
    },
    {
      iconName: 'adjustments-horizontal',
      iconBgClass: 'bg-purple-100',
      iconTextClass: 'text-purple-600',
      title: 'Smart Query Selection',
      description: 'Get AI-suggested search phrases that surface you (or your competitors) most often.',
      ariaLabel: 'Smart query selection'
    }
  ];
</script>

<section id="features" class="mt-24">
  <div class="grid md:grid-cols-3 gap-6">
    {#each features as feature}
      <FeatureCard {...feature} />
    {/each}
  </div>
</section>
