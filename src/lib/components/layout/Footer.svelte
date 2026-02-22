<script lang="ts">
  const version = '0.3.0';
</script>

<footer class="relative mt-0 border-t border-slate-200/70 bg-white/70 backdrop-blur-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3">
    <div class="flex flex-col sm:flex-row items-center justify-between gap-2">
      <div class="inline-flex items-center gap-2 font-medium text-slate-700 text-[13px]">
  <span class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[rgb(var(--color-primary))] to-indigo-600 text-white font-bold text-[10px] shadow-sm">RL</span>
        <span class="tracking-tight">RankLens</span>
        <span class="text-[10px] text-slate-400">v{version}</span>
      </div>
      <div class="flex items-center gap-4 text-[11px] text-slate-500">
        <a href="/about/privacy" class="hover:text-slate-700">Privacy</a>
        <a href="/about/terms" class="hover:text-slate-700">Terms</a>
        <span class="hidden sm:inline text-slate-400">© {new Date().getFullYear()} RankLens.</span>
      </div>
    </div>
    <p class="sm:hidden mt-2 text-[10px] text-slate-500 text-center">© {new Date().getFullYear()} RankLens.</p>
  </div>
</footer>