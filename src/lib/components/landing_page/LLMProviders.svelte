<script lang="ts">
  import { PROVIDER_DISPLAY_NAMES, LLMProviderId } from "$lib/constants/llm";
  import LLMLogo from '$lib/components/logos/LLMLogo.svelte';
</script>

<section class="mt-20">
  <div
    class="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-80"
  >
    <div class="flex items-center gap-2 text-slate-500 text-sm">
      <LLMLogo provider="OpenAI" size={20} class="h-5 w-5" />
      {PROVIDER_DISPLAY_NAMES[LLMProviderId.OPENAI]}
    </div>
    <div class="flex items-center gap-2 text-slate-500 text-sm">
      <LLMLogo provider="Gemini" size={20} class="h-5 w-5" />
      {PROVIDER_DISPLAY_NAMES[LLMProviderId.GEMINI]}
    </div>
  </div>
</section>
