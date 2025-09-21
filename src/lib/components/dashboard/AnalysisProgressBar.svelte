<script lang="ts">
  interface EstimationState { totalSeconds: number }
  const { estimation }: { estimation: EstimationState } = $props()

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }
</script>

<div class="bg-white rounded-md border border-slate-200 p-3 flex items-center gap-3 w-full max-w-sm">
  <div class="h-6 w-6 rounded-full border-2 border-slate-200 border-t-[rgb(var(--color-primary))] animate-spin"></div>
  <div class="flex-1 min-w-0">
    <p class="text-md font-medium text-slate-700 leading-snug">Analysis running…</p>
    <p class="text-[11px] text-slate-500 truncate">Estimated time: {formatTime(estimation.totalSeconds)}</p>
  </div>
</div>
