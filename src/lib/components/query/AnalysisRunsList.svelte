<script lang="ts">
  import Card from "$lib/components/ui/Card.svelte";
  import Button from "$lib/components/ui/Button.svelte";

  interface Props {
    analysisRuns: { id: string; created_at: string }[]
    selectedRunId: string | null
    onSelectRun: (runId: string) => void
  }

  let { analysisRuns, selectedRunId, onSelectRun }: Props = $props();

  function formatDate(d: string) {
    return new Date(d).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<Card padding="p-6" custom="lg:col-span-5">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-sm font-semibold text-slate-700 tracking-wide">
      Analysis Runs
    </h3>
    <span class="text-[11px] text-slate-500"
      >{analysisRuns.length} total</span
    >
  </div>
  {#if analysisRuns.length > 0}
    <div class="space-y-2">
      {#each analysisRuns as run (run.id)}
        <Button
          type="button"
          variant="subtle"
          size="sm"
          onClick={() => onSelectRun(run.id)}
          class="w-full justify-start text-left p-3 rounded-lg border transition-colors {selectedRunId === run.id ? 'bg-black/5 border-black' : 'bg-white border-slate-200 hover:border-slate-300'}"
        >
          <span class="w-full flex items-center justify-between">
            <span class="text-xs font-medium text-slate-700">{formatDate(run.created_at)}</span>
            {#if selectedRunId === run.id}
              <span class="inline-flex items-center rounded-full bg-[rgb(var(--color-primary))] text-white px-2 py-0.5 text-[10px] font-medium">Active</span>
            {/if}
          </span>
        </Button>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-slate-500">
      No runs yet. Trigger an analysis from the dashboard.
    </p>
  {/if}
</Card>
