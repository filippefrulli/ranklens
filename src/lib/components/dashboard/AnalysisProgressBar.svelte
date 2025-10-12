<script lang="ts">
  interface EstimationState { totalSeconds: number }
  interface Props {
    estimation?: EstimationState
    completedCalls?: number
    totalCalls?: number
  }
  const { estimation = { totalSeconds: 0 }, completedCalls = 0, totalCalls = 0 }: Props = $props()

  // No longer showing estimated time; keep function for potential future use
  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const percent = $derived.by(() => {
    if (!totalCalls || totalCalls <= 0) return 0
    const p = Math.round((completedCalls / totalCalls) * 100)
    return Math.min(100, Math.max(0, p))
  })

  const isComplete = $derived(percent === 100 && totalCalls > 0)
</script>

<div class="bg-white rounded-md border border-slate-200 p-3 flex items-center gap-3 w-full max-w-sm">
  {#if isComplete}
    <div class="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
      <svg class="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
    </div>
  {:else}
    <div class="h-6 w-6 rounded-full border-2 border-slate-200 border-t-[rgb(var(--color-primary))] animate-spin"></div>
  {/if}
  <div class="flex-1 min-w-0">
    <p class="text-md font-medium leading-snug" class:text-emerald-700={isComplete} class:text-slate-700={!isComplete}>
      {isComplete ? 'Analysis complete!' : 'Analysis running…'}
    </p>
    <div class="mt-1 w-full h-2 rounded-full bg-slate-200 overflow-hidden">
      {#if totalCalls > 0}
        <div class="h-2 transition-all duration-300" class:bg-emerald-500={isComplete} class:bg-[rgb(var(--color-primary))]={!isComplete} style={`width:${percent}%`}></div>
      {:else}
        <div class="h-2 bg-[rgb(var(--color-primary))]/70 animate-pulse" style="width:33%"></div>
      {/if}
    </div>
    {#if totalCalls > 0}
      <p class="mt-1 text-[11px]" class:text-emerald-600={isComplete} class:text-slate-600={!isComplete}>
        {completedCalls} of {totalCalls} calls ({percent}%)
      </p>
    {:else}
      <p class="mt-1 text-[11px] text-slate-500 truncate">Starting…</p>
    {/if}
  </div>
</div>
