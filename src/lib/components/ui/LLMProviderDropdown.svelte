<script lang="ts">
  import type { LLMProvider } from '../../types'
  
  interface Props {
    providers: LLMProvider[]
    selectedProvider: LLMProvider | null
    onProviderChange?: (provider: LLMProvider | null) => void
    label?: string
    showLabel?: boolean
    size?: 'sm' | 'md' | 'lg'
  }
  
  let { 
    providers, 
    selectedProvider, 
    onProviderChange, 
    label = 'LLM Provider:',
    showLabel = true,
    size = 'md'
  }: Props = $props()

  let isOpen = $state(false)
  let dropdownRef: HTMLDivElement

  import { resolveProviderId, LLMProviderId } from '$lib/constants/llm'
  import LLMLogo from '$lib/components/logos/LLMLogo.svelte'

  // Provider icons mapping using canonical provider id

  // Icon size based on component size
  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  }

  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  // Dropdown text sizes (smaller than button text)
  const dropdownTextSizeClasses = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm'
  }

  function handleProviderSelect(provider: LLMProvider | null) {
    onProviderChange?.(provider)
    isOpen = false
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      isOpen = false
    }
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      isOpen = false
    }
  }

  // Get display text for selected provider
  const selectedDisplayText = $derived(selectedProvider?.name || 'All Providers')
  const selectedIconName = $derived(selectedProvider ? selectedProvider.name : 'All Providers')
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeydown} />

<div class="flex items-center gap-3">
  {#if showLabel}
    <span class="font-medium text-gray-700 {labelSizeClasses[size]}">
      {label}
    </span>
  {/if}
  
  <div class="relative" bind:this={dropdownRef}>
    <!-- Selected Value Display -->
    <button
      type="button"
      onclick={() => isOpen = !isOpen}
  class="flex items-center gap-2 border border-gray-300 rounded-md bg-white {sizeClasses[size]} pr-8 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/50 focus:border-[rgb(var(--color-primary))] cursor-pointer hover:bg-gray-50 w-full text-left"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
    >
      <LLMLogo provider={selectedIconName} size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} class="{iconSizeClasses[size]} flex-shrink-0" />
      <span class="flex-1 truncate">{selectedDisplayText}</span>
    </button>
    
    <!-- Dropdown Arrow -->
    <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
      <svg 
        class="w-4 h-4 text-gray-400 transform transition-transform {isOpen ? 'rotate-180' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </div>

    <!-- Dropdown Menu -->
    {#if isOpen}
      <div class="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
        <!-- All Providers Option -->
        <button
          type="button"
          onclick={() => handleProviderSelect(null)}
          class="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none {sizeClasses[size].split(' ')[0]} {selectedProvider === null ? 'bg-black/5 text-slate-900' : 'text-gray-900'}"
        >
          <LLMLogo provider="All Providers" size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} class="{iconSizeClasses[size]} flex-shrink-0" />
          <span>All Providers</span>
        </button>

        <!-- Individual Providers -->
        {#each providers as provider (provider.id)}
          <button
            type="button"
            onclick={() => handleProviderSelect(provider)}
            class="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none {sizeClasses[size].split(' ')[0]} {selectedProvider?.id === provider.id ? 'bg-black/5 text-slate-900' : 'text-gray-900'}"
          >
            <LLMLogo provider={provider.name} size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} class="{iconSizeClasses[size]} flex-shrink-0" />
            <span>{provider.name}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
