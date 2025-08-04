<script lang="ts">
  import svelteLogo from './assets/svelte.svg'
  import viteLogo from '/vite.svg'
  import Counter from './lib/Counter.svelte'
  import { supabase } from './lib/supabase'
  import { onMount } from 'svelte'

  let connectionStatus = 'Testing connection...'

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

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-8">
  <div class="max-w-4xl mx-auto text-center">
    <div class="flex justify-center items-center space-x-8 mb-8">
      <a href="https://vite.dev" target="_blank" rel="noreferrer" class="transform hover:scale-110 transition-transform">
        <img src={viteLogo} class="h-24 w-24 hover:drop-shadow-lg" alt="Vite Logo" />
      </a>
      <a href="https://svelte.dev" target="_blank" rel="noreferrer" class="transform hover:scale-110 transition-transform">
        <img src={svelteLogo} class="h-24 w-24 hover:drop-shadow-lg hover:filter hover:drop-shadow-[0_0_2em_#ff3e00aa]" alt="Svelte Logo" />
      </a>
    </div>
    
    <h1 class="text-6xl font-bold text-gray-800 mb-4">RankLens</h1>
    <p class="text-xl text-gray-600 mb-8">SvelteKit + Tailwind CSS + Supabase</p>

    <div class="bg-white rounded-xl shadow-lg p-8 mb-8">
      <Counter />
    </div>

    <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h3 class="text-lg font-semibold text-gray-800 mb-2">Supabase Connection Status</h3>
      <p class="text-sm text-gray-600">{connectionStatus}</p>
    </div>

    <div class="grid md:grid-cols-3 gap-6 text-left">
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">🚀 SvelteKit</h3>
        <p class="text-gray-600 text-sm">Fast, lightweight framework with file-based routing and server-side rendering.</p>
      </div>
      
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">🎨 Tailwind CSS</h3>
        <p class="text-gray-600 text-sm">Utility-first CSS framework for rapid UI development.</p>
      </div>
      
      <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">🗄️ Supabase</h3>
        <p class="text-gray-600 text-sm">Open source Firebase alternative with PostgreSQL database.</p>
      </div>
    </div>

    <div class="mt-8">
      <p class="text-gray-500 text-sm">
        Check out <a href="https://github.com/sveltejs/kit#readme" target="_blank" rel="noreferrer" class="text-blue-600 hover:text-blue-800 underline">SvelteKit documentation</a> to get started!
      </p>
    </div>
  </div>
</main>
