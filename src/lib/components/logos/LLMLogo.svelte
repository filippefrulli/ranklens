<script lang="ts">
  import { normalizeProvider, LLMProviderId } from '$lib/constants/llm';

  interface Props {
    provider: string; // can be raw name, alias, or canonical id
    size?: number; // px size (width & height)
    class?: string; // tailwind utility overrides
    squared?: boolean; // force square container style
    rounded?: boolean; // apply rounded style for raster logos if desired
    alt?: string; // override alt text
    loading?: 'lazy' | 'eager';
  }

  let {
    provider,
    size = 24,
    class: className = '',
    squared = true,
    rounded = false,
    alt = undefined,
    loading = 'lazy'
  }: Props = $props();

  let id = $state<LLMProviderId | null>(null);
  let displayName = $state<string>(provider);

  $effect(() => {
    try {
      const norm = normalizeProvider(provider);
      id = norm.id;
      displayName = norm.displayName;
    } catch {
      id = null;
      displayName = provider;
    }
  });

  const dimension = size + 'px';
  const baseCls = `${squared ? '' : ''}`; // placeholder for future variants

  function srcFor(id: LLMProviderId | null): string {
    switch (id) {
      case LLMProviderId.OPENAI:
        return '/images/providers/openai.svg';
      case LLMProviderId.GEMINI:
        return '/images/providers/gemini.png';
      default:
        return '/images/providers/all.png';
    }
  }
</script>

<img
  src={srcFor(id)}
  alt={alt || displayName}
  class={`object-contain ${rounded ? 'rounded' : ''} ${className}`}
  width={size}
  height={size}
  style={`width:${dimension};height:${dimension};`}
  loading={loading}
/>
