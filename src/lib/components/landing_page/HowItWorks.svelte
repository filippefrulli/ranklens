<script lang="ts">
  const steps = [
    { 
      step: 1, 
      title: "Set Up Project", 
      copy: "Define your business profile (name, location, type)." 
    },
    { 
      step: 2, 
      title: "Add Queries", 
      copy: "Pick or generate search phrases customers would use." 
    },
    { 
      step: 3, 
      title: "Run Analysis", 
      copy: "RankLens queries each provider multiple times for statistical reliability." 
    },
    { 
      step: 4, 
      title: "Get Insights", 
      copy: "See rankings, competitor visibility and improvement opportunities." 
    }
  ];
</script>

<section class="mt-28">
  <div
    class="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-10"
  >
    <h2 class="text-2xl font-semibold text-slate-800 text-center mb-10">
      How It Works
    </h2>
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
      {#each steps as item}
        <div class="text-center">
          <div
            class="mx-auto mb-4 h-10 w-10 flex items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-white text-sm font-medium"
          >
            {item.step}
          </div>
          <h3 class="text-sm font-semibold text-slate-700 mb-1">
            {item.title}
          </h3>
          <p class="text-xs text-slate-500 leading-relaxed">
            {item.copy}
          </p>
        </div>
      {/each}
    </div>
  </div>
</section>
