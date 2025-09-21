<script lang="ts">
  export let message = 'Loading...'
</script>

<div class="flex flex-col items-center justify-center py-12">
  <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--color-primary))]"></div>
  <p class="mt-4 text-gray-600">{message}</p>
</div>
