<script lang="ts">
  import Dashboard from './lib/Dashboard.svelte'
  import { supabase } from './lib/supabase'
  import { onMount } from 'svelte'

  let connectionStatus = $state('Testing connection...')
  let showDemo = $state(true)

  onMount(async () => {
    try {
      const { data, error } = await supabase.from('_metadata').select('*').limit(1)
      if (error && error.message.includes('relation "_metadata" does not exist')) {
        connectionStatus = 'Connected to Supabase! (No tables found, which is expected for a new project)'
      } else if (error) {
        connectionStatus = `Supabase connection error: ${error.message}`
      } else {
        connectionStatus = 'Connected to Supabase successfully!'
      }
    } catch (err) {
      connectionStatus = 'Please configure your Supabase environment variables'
    }
  })
</script>

{#if showDemo}
  <!-- Landing Page -->
  <main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <h1 class="text-2xl font-bold text-gray-900">RankLens</h1>
          <button 
            onclick={() => showDemo = false}
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Launch App
          </button>
        </div>
      </div>
    </header>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="text-center mb-16">
        <h1 class="text-5xl font-bold text-gray-900 mb-6">
          Track Your Business Rankings Across All LLMs
        </h1>
        <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Discover how your business ranks when customers ask AI assistants for recommendations. 
          Get insights from OpenAI, Anthropic, Google, Cohere, and Perplexity with detailed analytics.
        </p>
        
        <div class="flex justify-center space-x-4">
          <button 
            onclick={() => showDemo = false}
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            Get Started
          </button>
          <a 
            href="#features" 
            class="bg-white hover:bg-gray-50 text-blue-600 font-bold py-3 px-8 rounded-lg shadow-lg border-2 border-blue-600 transform hover:scale-105 transition-all duration-200"
          >
            Learn More
          </a>
        </div>
      </div>

      <!-- Features Section -->
      <div id="features" class="grid md:grid-cols-3 gap-8 mb-16">
        <div class="bg-white rounded-xl shadow-lg p-8 text-center">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-3">Multi-LLM Analysis</h3>
          <p class="text-gray-600">Test your rankings across OpenAI GPT-4, Claude, Gemini, Cohere, and Perplexity with automated queries.</p>
        </div>

        <div class="bg-white rounded-xl shadow-lg p-8 text-center">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-3">Ranking Analytics</h3>
          <p class="text-gray-600">Get detailed insights on your average rankings, mentions, and see which competitors rank higher.</p>
        </div>

        <div class="bg-white rounded-xl shadow-lg p-8 text-center">
          <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-3">Custom Queries</h3>
          <p class="text-gray-600">Define up to 5 custom search queries that matter to your business and track performance over time.</p>
        </div>
      </div>

      <!-- How It Works -->
      <div class="bg-white rounded-xl shadow-lg p-8 mb-16">
        <h2 class="text-3xl font-bold text-gray-900 text-center mb-8">How It Works</h2>
        
        <div class="grid md:grid-cols-4 gap-8">
          <div class="text-center">
            <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">1</div>
            <h3 class="font-semibold text-gray-900 mb-2">Set Up Project</h3>
            <p class="text-sm text-gray-600">Create a project for your business and define your industry and location.</p>
          </div>
          
          <div class="text-center">
            <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">2</div>
            <h3 class="font-semibold text-gray-900 mb-2">Add Queries</h3>
            <p class="text-sm text-gray-600">Define search queries your customers might use when looking for businesses like yours.</p>
          </div>
          
          <div class="text-center">
            <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">3</div>
            <h3 class="font-semibold text-gray-900 mb-2">Run Analysis</h3>
            <p class="text-sm text-gray-600">Our system queries 5 major LLMs 5 times each to get comprehensive ranking data.</p>
          </div>
          
          <div class="text-center">
            <div class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">4</div>
            <h3 class="font-semibold text-gray-900 mb-2">Get Insights</h3>
            <p class="text-sm text-gray-600">View your average rankings, competitor analysis, and improvement opportunities.</p>
          </div>
        </div>
      </div>

      <!-- Connection Status -->
      <div class="bg-white rounded-xl shadow-lg p-6 text-center">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">System Status</h3>
        <p class="text-sm text-gray-600">{connectionStatus}</p>
        
        <div class="mt-4 text-xs text-gray-500">
          <p>• Configure your Supabase database using the provided schema</p>
          <p>• Add your LLM API keys to start analyzing rankings</p>
          <p>• Built with SvelteKit, Tailwind CSS, and TypeScript</p>
        </div>
      </div>
    </div>
  </main>
{:else}
  <!-- Dashboard Application -->
  <Dashboard />
{/if}
