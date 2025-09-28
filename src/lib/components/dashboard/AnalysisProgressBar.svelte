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
</script>

<div class="bg-white rounded-md border border-slate-200 p-3 flex items-center gap-3 w-full max-w-sm">
  <div class="h-6 w-6 rounded-full border-2 border-slate-200 border-t-[rgb(var(--color-primary))] animate-spin"></div>
  <div class="flex-1 min-w-0">
    <p class="text-md font-medium text-slate-700 leading-snug">Analysis running…</p>
    <div class="mt-1 w-full h-2 rounded-full bg-slate-200 overflow-hidden">
      {#if totalCalls > 0}
        <div class="h-2 bg-[rgb(var(--color-primary))]" style={`width:${percent}%`}></div>
      {:else}
        <div class="h-2 bg-[rgb(var(--color-primary))]/70 animate-pulse" style="width:33%"></div>
      {/if}
    </div>
    {#if totalCalls > 0}
      <p class="mt-1 text-[11px] text-slate-600">
        {completedCalls} of {totalCalls} calls ({percent}%)
      </p>
    {:else}
      <p class="mt-1 text-[11px] text-slate-500 truncate">Starting…</p>
    {/if}
  </div>
</div>
