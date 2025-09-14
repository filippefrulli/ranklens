<script lang="ts">
    import type { Snippet } from 'svelte'
    import { createEventDispatcher } from 'svelte';
    interface Props {
    variant?: 'primary' | 'secondary' | 'subtle' | 'danger' | 'glass'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    type?: 'button' | 'submit'
    disabled?: boolean
  href?: string
  fullWidth?: boolean
  ariaLabel?: string
      title?: string
      children?: Snippet
      onClick?: (e: MouseEvent) => void
  }
  let {
    variant = 'primary',
    size = 'md',
    loading = false,
    type = 'button',
    disabled = false,
    href = undefined,
    fullWidth = false,
    ariaLabel = undefined,
    title = undefined,
    children,
    onClick
  }: Props = $props()

  const dispatch = createEventDispatcher<{ click: MouseEvent }>();

  function handleClick(e: MouseEvent) {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    // invoke optional supplied prop handler then dispatch component event
    onClick?.(e);
    dispatch('click', e);
  }

  const base = 'inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
  const variants: Record<string,string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    secondary: 'bg-slate-800 text-white hover:bg-slate-900',
    subtle: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    glass: 'bg-white/70 backdrop-blur text-blue-700 border border-blue-200 hover:bg-white'
  }
  const sizes: Record<string,string> = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-sm px-5 py-2.5'
  }

  const widthClass = fullWidth ? 'w-full' : ''
</script>

{#if href}
  <a href={href} aria-label={ariaLabel} {title} class={`${base} ${variants[variant]} ${sizes[size]} ${widthClass}`} aria-busy={loading ? 'true' : 'false'} onclick={handleClick}>
    {#if loading}
      <svg class="animate-spin h-4 w-4 mr-2 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="4" class="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke-width="4" class="opacity-75"/></svg>
    {/if}
    {@render children?.()}
  </a>
{:else}
  <button {type} aria-label={ariaLabel} {title} class={`${base} ${variants[variant]} ${sizes[size]} ${widthClass}`} disabled={disabled || loading} aria-busy={loading ? 'true' : 'false'} onclick={handleClick}>
    {#if loading}
      <svg class="animate-spin h-4 w-4 mr-2 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="4" class="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke-width="4" class="opacity-75"/></svg>
    {/if}
    {@render children?.()}
  </button>
{/if}
