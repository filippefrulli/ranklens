/**
 * Utility functions for ranking display and calculations
 */

/**
 * Get the CSS classes for rank badge based on rank value
 * Uses the raw rank value (no rounding) for consistent coloring
 */
export function getRankBadgeClass(rank: number | null | undefined): string {
  if (rank === null || rank === undefined) return 'bg-gray-100 text-gray-800'
  if (rank <= 3) return 'bg-green-100 text-green-800'
  if (rank <= 7) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

/**
 * Format rank for display with consistent precision
 */
export function formatRank(rank: number | null | undefined): string {
  if (rank === null || rank === undefined) return 'N/A'
  return `#${rank.toFixed(1)}`
}