<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { DatabaseService } from '../../../lib/services/database-service'
  import { user } from '../../../lib/services/auth-service'
  import QueryResultHeader from '../../../lib/components/query/QueryResultHeader.svelte'
  import QueryResultTable from '../../../lib/components/query/QueryResultTable.svelte'
  import CompetitorRankingsTable from '../../../lib/components/query/CompetitorRankingsTable.svelte'
  import LoadingSpinner from '../../../lib/components/ui/LoadingSpinner.svelte'
  import ErrorMessage from '../../../lib/components/ui/ErrorMessage.svelte'
  import type { Query, RankingAttempt } from '../../../lib/types'

  let query = $state<Query | null>(null)
  let rankingResults = $state<RankingAttempt[]>([])
  let competitorRankings = $state<any[]>([])
  let loading = $state(false)
  let error = $state<string | null>(null)

  // Reactive queryId from page params using $derived
  let queryId = $derived($page.params.id || '')

  // Load data when queryId or user changes
  $effect(() => {
    console.log('🔄 Effect triggered - queryId:', queryId, 'user:', $user)
    
    if (!$user) {
      console.log('❌ No user, redirecting to login')
      goto('/auth/login')
      return
    }
    
    if (!queryId) {
      console.log('❌ No query ID provided')
      error = 'Invalid query ID'
      return
    }
    
    // Call the async function
    loadQueryResults()
  })

  async function loadQueryResults() {
    if (!queryId) return
    
    try {
      console.log('🔄 Starting to load query results for ID:', queryId)
      loading = true
      error = null

      // Get query details
      console.log('📋 Fetching query details...')
      const queryData = await DatabaseService.getQuery(queryId)
      console.log('📋 Query data received:', queryData)
      
      if (!queryData) {
        console.log('❌ Query not found')
        error = 'Query not found'
        return
      }

      // Verify the query belongs to the user's business
      if ($user) {
        console.log('🏢 Fetching user business...')
        const business = await DatabaseService.getBusiness($user.id)
        console.log('🏢 Business data:', business)
        
        if (!business || queryData.business_id !== business.id) {
          console.log('❌ Access denied - business mismatch')
          error = 'Access denied'
          return
        }
      }

      query = queryData
      console.log('✅ Query set successfully')

      // Get ranking results for this query
      console.log('📊 Fetching ranking results...')
      const results = await DatabaseService.getQueryRankingResults(queryId)
      console.log('📊 Ranking results received:', results)
      
      rankingResults = results

      // Get competitor rankings
      console.log('🏆 Fetching competitor rankings...')
      const competitors = await DatabaseService.getCompetitorRankings(queryId)
      console.log('🏆 Competitor rankings received:', competitors)
      
      competitorRankings = competitors
      console.log('✅ All data loaded successfully')

    } catch (err: any) {
      console.error('💥 Error loading query results:', err)
      error = err.message || 'Failed to load query results'
    } finally {
      loading = false
      console.log('🏁 Loading completed')
    }
  }

  function goBack() {
    goto('/')
  }
</script>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {#if loading}
      <LoadingSpinner message="Loading query results..." />
    {:else if error}
      <ErrorMessage {error} onDismiss={() => error = null} />
      <div class="mt-4">
        <button 
          onclick={goBack}
          class="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
        >
          ← Back to Dashboard
        </button>
      </div>
    {:else if query}
      <QueryResultHeader {query} {goBack} />
      <QueryResultTable {rankingResults} />
      <CompetitorRankingsTable {competitorRankings} />
    {/if}
  </div>
</div>
