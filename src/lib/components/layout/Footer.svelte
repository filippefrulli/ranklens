<script lang="ts">
  const version = '1.0.6';
</script>

<footer class="bg-white mt-16">
  <div class="h-px bg-gray-100"></div>
  <div class="max-w-6xl mx-auto py-8 px-6">
    <div class="flex flex-col md:flex-row justify-between items-center">
      <div class="mb-4 md:mb-0">
        <p class="text-gray-600 text-sm">
          {('footer.copyright')}
        </p>
        <p class="text-gray-400 text-xs mt-1">
          v{version}
        </p>
      </div>
      <div class="flex space-x-6">
        <a href="/about" class="text-gray-600 hover:text-black text-sm transition-colors cursor-pointer">{('footer.about')}</a>
        <a href="/about/privacy" class="text-gray-600 hover:text-black text-sm transition-colors cursor-pointer">{('footer.privacy')}</a>
        <a href="/about/terms" class="text-gray-600 hover:text-black text-sm transition-colors cursor-pointer">{('footer.terms')}</a>
      </div>
    </div>
  </div>
</footer>