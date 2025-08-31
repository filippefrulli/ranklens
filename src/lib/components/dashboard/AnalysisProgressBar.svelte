<script lang="ts">
  interface ProgressState {
    currentStep: number
    totalSteps: number
    percentage: number
    currentQuery: string
    currentProvider: string
  }

  const { progress }: { progress: ProgressState } = $props()
</script>

<div class="bg-white rounded-lg shadow-md p-6 mb-6">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold text-gray-900">Analysis in Progress</h3>
    <span class="text-sm font-medium text-gray-600">{progress.percentage}%</span>
  </div>
  
  <!-- Progress Bar -->
  <div class="w-full bg-gray-200 rounded-full h-3 mb-4">
    <div 
      class="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
      style="width: {progress.percentage}%"
    ></div>
  </div>
  
  <!-- Animation for active state -->
  <div class="mt-8 flex items-center justify-center">
    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
    <span class="text-sm text-gray-600">Running analysis...</span>
  </div>
</div>
