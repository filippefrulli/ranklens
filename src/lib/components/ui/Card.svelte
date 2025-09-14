<script lang="ts">
    import type { Snippet } from 'svelte'
    interface Props {
    padding?: string
    hover?: boolean
    clickable?: boolean
    variant?: 'solid' | 'glass'
    radius?: 'md' | 'lg' | 'xl' | '2xl'
    shadow?: boolean
    custom?: string // extra utility classes appended
    children?: Snippet
  }
  let {
    padding = 'p-6',
    hover = false,
    clickable = false,
    variant = 'solid',
    radius = 'xl',
    shadow = true,
    custom = '',
    children
  }: Props = $props()

  const variantClasses: Record<string,string> = {
    solid: 'bg-white',
    glass: 'bg-white/80 backdrop-blur'
  }

  const radiusClasses: Record<string,string> = {
    md: 'rounded-lg',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl'
  }
</script>

<div class={`border border-slate-200 ${variantClasses[variant]} ${radiusClasses[radius]} ${shadow ? 'shadow-sm' : ''} ${padding} ${hover ? 'transition-colors hover:border-slate-300' : ''} ${clickable ? 'cursor-pointer' : ''} ${custom}`}>
  {@render children?.()}
</div>
