<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import Icon, { type IconName } from '$lib/components/icons/Icon.svelte';

  interface Props {
    iconName: IconName
    iconBgClass: string
    iconTextClass: string
    title: string
    description: string
    ariaLabel: string
  }

  let { 
    iconName, 
    iconBgClass, 
    iconTextClass, 
    title, 
    description,
    ariaLabel 
  }: Props = $props();
</script>

<Card variant="glass" padding="p-6" custom="flex flex-col">
  <div
    class="h-12 w-12 rounded-lg flex items-center justify-center mb-4 {iconBgClass} {iconTextClass}"
  >
    <Icon name={iconName} class="w-6 h-6" {ariaLabel} />
  </div>
  <h3 class="text-base font-semibold text-slate-800 mb-2">
    {title}
  </h3>
  <p class="text-sm text-slate-600 leading-relaxed flex-1">
    {description}
  </p>
</Card>
