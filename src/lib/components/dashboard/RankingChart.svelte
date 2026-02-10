<script lang="ts">
  import type { MeasurementRankingHistory, RankingAnalytics } from '../../types'
  
  interface Props {
    history?: MeasurementRankingHistory[]
    llmBreakdown?: RankingAnalytics['llm_breakdown']
    loading?: boolean
  }

  let { history = [], llmBreakdown = [], loading = false }: Props = $props()

  // Determine data points to display
  const dataPoints = $derived.by(() => {
    if (history.length > 0) {
      // Sort by date ascending (oldest to newest) for left-to-right chronological display
      const sortedHistory = [...history].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateA - dateB
      })
      
      return sortedHistory.slice(-8).map(run => ({
        value: run.average_rank || 0,
        label: formatDate(run.created_at),
        tooltip: `Rank ${run.average_rank?.toFixed(1) || 'N/A'} on ${formatDate(run.created_at)}`
      }))
    } else if (llmBreakdown && llmBreakdown.length > 0) {
      return llmBreakdown.slice(0, 8).map(breakdown => ({
        value: breakdown.average_rank || 0,
        label: breakdown.provider_name?.substring(0, 3) || 'LLM',
        tooltip: `${breakdown.provider_name}: Rank ${breakdown.average_rank?.toFixed(1) || 'N/A'}`
      }))
    }
    return []
  })

  // Chart dimensions
  const chartHeight = 100
  const chartWidth = 200
  const padding = { top: 10, right: 10, bottom: 20, left: 30 }
  const innerHeight = chartHeight - padding.top - padding.bottom
  const innerWidth = chartWidth - padding.right - padding.left

  // Y-axis scale (ranks: 1 = best, 25 = worst)
  const yScale = $derived.by(() => {
    if (dataPoints.length === 0) return (val: number) => innerHeight / 2
    
    const maxRank = Math.max(...dataPoints.map(d => d.value), 10)
    const minRank = Math.min(...dataPoints.map(d => d.value), 1)
    const yRange = maxRank - minRank
    
    return (rank: number) => {
      // Invert: rank 1 at top, higher ranks at bottom
      return innerHeight - ((rank - minRank) / (yRange || 1)) * innerHeight
    }
  })

  // X-axis scale function
  function xScale(index: number): number {
    if (dataPoints.length <= 1) return innerWidth / 2
    return (index / (dataPoints.length - 1)) * innerWidth
  }

  // Y-axis ticks (show 3-4 rank markers)
  const yTicks = $derived.by(() => {
    if (dataPoints.length === 0) return [1, 5, 10]
    
    const maxRank = Math.max(...dataPoints.map(d => d.value), 10)
    const minRank = Math.min(...dataPoints.map(d => d.value), 1)
    
    if (maxRank <= 5) return [1, 3, 5]
    if (maxRank <= 10) return [1, 5, 10]
    if (maxRank <= 15) return [1, 5, 10, 15]
    return [1, 5, 10, 15, 20]
  })

  // Generate SVG path for line
  const linePath = $derived.by(() => {
    if (dataPoints.length === 0) return ''
    
    return dataPoints
      .map((point, i) => {
        const x = xScale(i)
        const y = yScale(point.value)
        return `${i === 0 ? 'M' : 'L'} ${x + padding.left} ${y + padding.top}`
      })
      .join(' ')
  })

  function formatDate(dateStr: string): string {
    // Handle date string from PostgreSQL (can be date or timestamp)
    try {
      if (!dateStr) return 'N/A'
      
      // Extract date portion (YYYY-MM-DD) from timestamp or use as-is
      const datePart = dateStr.split('T')[0]
      
      // Parse the date in local timezone to avoid shifts
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [year, month, day] = datePart.split('-').map(Number)
        const date = new Date(year, month - 1, day) // month is 0-indexed
        
        if (isNaN(date.getTime())) {
          return 'N/A'
        }
        
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric'
        })
      }
      
      return 'N/A'
    } catch (error) {
      return 'N/A'
    }
  }
</script>

<div class="flex-1 max-w-72">
  <div class="text-sm text-gray-500 mb-2">
    {history.length > 0 ? 'Ranking History' : 'LLM Breakdown'}
  </div>
  
  <div class="h-32 bg-gray-50 rounded relative">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="text-xs text-gray-400 flex items-center">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
          Loading...
        </div>
      </div>
    {:else if dataPoints.length === 0}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="text-xs text-gray-400">No data</div>
      </div>
    {:else}
      <svg
        viewBox="0 0 {chartWidth} {chartHeight}"
        class="w-full h-full"
        aria-label="Ranking chart"
      >
        <!-- Y-axis grid lines and labels -->
        {#each yTicks as tick}
          {@const y = yScale(tick) + padding.top}
          <line
            x1={padding.left}
            y1={y}
            x2={chartWidth - padding.right}
            y2={y}
            stroke="#e5e7eb"
            stroke-width="1"
            stroke-dasharray="2,2"
          />
          <text
            x={padding.left - 5}
            y={y}
            text-anchor="end"
            dominant-baseline="middle"
            class="text-[8px] fill-gray-400"
          >
            {tick}
          </text>
        {/each}

        <!-- Line path -->
        <path
          d={linePath}
          fill="none"
          stroke="rgb(var(--color-primary))"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Data points -->
        {#each dataPoints as point, i}
          {@const x = xScale(i) + padding.left}
          {@const y = yScale(point.value) + padding.top}
          <circle
            cx={x}
            cy={y}
            r="3"
            fill="rgb(var(--color-primary))"
            class="cursor-pointer hover:r-4 transition-all"
          >
            <title>{point.tooltip}</title>
          </circle>
        {/each}

        <!-- X-axis labels (show first, last, and middle if space allows) -->
        {#if dataPoints.length >= 2}
          {@const showMiddle = dataPoints.length >= 4}
          {@const middleIndex = Math.floor(dataPoints.length / 2)}
          
          <!-- First label -->
          <text
            x={xScale(0) + padding.left}
            y={chartHeight - 5}
            text-anchor="middle"
            class="text-[7px] fill-gray-400"
          >
            {dataPoints[0].label}
          </text>
          
          <!-- Middle label (if space allows) -->
          {#if showMiddle}
            <text
              x={xScale(middleIndex) + padding.left}
              y={chartHeight - 5}
              text-anchor="middle"
              class="text-[7px] fill-gray-400"
            >
              {dataPoints[middleIndex].label}
            </text>
          {/if}
          
          <!-- Last label -->
          <text
            x={xScale(dataPoints.length - 1) + padding.left}
            y={chartHeight - 5}
            text-anchor="middle"
            class="text-[7px] fill-gray-400"
          >
            {dataPoints[dataPoints.length - 1].label}
          </text>
        {/if}
      </svg>
    {/if}
  </div>
</div>
