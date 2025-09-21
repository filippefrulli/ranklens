<script lang="ts">
  // Reusable outline icon component (Heroicons-inspired) without external dependency
  export type IconName = 'globe-alt' | 'chart-bar' | 'adjustments-horizontal';

  interface Props {
    name: IconName;
    size?: number | string; // tailwind classes can also control size via class
    strokeWidth?: number;
    class?: string;
    ariaLabel?: string; // provide for non-decorative usage
  }

  let { name, size = 24, strokeWidth = 1.8, class: className = '', ariaLabel }: Props = $props();

  const svgSize = typeof size === 'number' ? `${size}` : size;

  // Map of SVG path definitions (outline style)
  function paths(name: IconName): string {
    switch (name) {
      case 'globe-alt':
        // Heroicons 2.0 outline: Globe Alt simplified
        return `M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m-8.4 6h16.8M3.6 15h16.8`;
      case 'chart-bar':
        return `M3 20h18M6 16v-5m6 5V8m6 8v-8`;
      case 'adjustments-horizontal':
        return `M3 8h10m4 0h4M6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm0 8h14M3 16h4m10 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z`;
    }
  }
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  width={svgSize}
  height={svgSize}
  class={className}
  aria-hidden={ariaLabel ? undefined : 'true'}
  aria-label={ariaLabel}
  role={ariaLabel ? 'img' : undefined}
>
  {#each paths(name).split('M').filter(Boolean) as segment, i}
    {#if i === 0}
      <path d={segment.startsWith('M') ? segment : 'M' + segment} />
    {:else}
      <path d={'M' + segment} />
    {/if}
  {/each}
</svg>

<style>
  /* No additional styles; styling handled via utility classes */
</style>
