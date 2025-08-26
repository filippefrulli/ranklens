<script lang="ts">
  import { onMount } from 'svelte'

  interface GooglePlacesResult {
    place_id: string
    name: string
    formatted_address: string
    types: string[]
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
    business_status?: string
    opening_hours?: {
      open_now: boolean
    }
  }

  interface SelectedBusiness {
    name: string
    google_place_id: string
    city: string
    google_primary_type?: string
    google_primary_type_display?: string
    google_types?: string[]
  }

  interface Props {
    onBusinessSelected: (business: SelectedBusiness) => void
    onCancel: () => void
  }

  let { onBusinessSelected, onCancel }: Props = $props()

  let searchQuery = $state('')
  let searchResults = $state<GooglePlacesResult[]>([])
  let isSearching = $state(false)
  let error = $state<string | null>(null)
  let placesService: any = null
  let mapDiv: HTMLDivElement

  onMount(() => {
    loadGoogleMapsAPI()
  })

  async function loadGoogleMapsAPI() {
    try {
      // Check if Google Maps is already loaded
      if (typeof (window as any).google !== 'undefined' && (window as any).google.maps) {
        initializePlacesService()
        return
      }

      // Load Google Maps API
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        throw new Error('Google Maps API key not found. Please set VITE_GOOGLE_MAPS_API_KEY in your environment.')
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
      script.onload = () => initializePlacesService()
      script.onerror = () => {
        error = 'Failed to load Google Maps API'
      }
      document.head.appendChild(script)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize Google Maps'
    }
  }

  function initializePlacesService() {
    try {
      const google = (window as any).google
      // Create a dummy map to initialize the PlacesService
      const map = new google.maps.Map(mapDiv, {
        center: { lat: 0, lng: 0 },
        zoom: 1
      })
      placesService = new google.maps.places.PlacesService(map)
    } catch (err) {
      error = 'Failed to initialize Google Places service'
    }
  }

  async function searchBusinesses() {
    if (!searchQuery.trim() || !placesService) return

    isSearching = true
    error = null
    searchResults = []

    try {
      const request = {
        query: searchQuery,
        type: 'establishment'
      }

      placesService.textSearch(request, (results: any, status: any) => {
        isSearching = false
        const google = (window as any).google
        
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          searchResults = results.slice(0, 5) // Limit to 5 results
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          error = 'No businesses found. Try a different search term.'
        } else {
          error = 'Search failed. Please try again.'
        }
      })
    } catch (err) {
      isSearching = false
      error = 'Search failed. Please try again.'
    }
  }

  function selectBusiness(place: GooglePlacesResult) {
    // Extract city from formatted_address
    const addressParts = place.formatted_address.split(', ')
    let city = ''
    
    // Try to find the city (usually second to last part before country)
    if (addressParts.length >= 2) {
      city = addressParts[addressParts.length - 2].split(' ')[0] // Remove postal code
    }

    // Get primary type and display name
    let primaryType = ''
    let primaryTypeDisplay = ''
    
    if (place.types && place.types.length > 0) {
      // Filter out generic types
      const specificTypes = place.types.filter(type => 
        !['establishment', 'point_of_interest'].includes(type)
      )
      
      if (specificTypes.length > 0) {
        primaryType = specificTypes[0]
        primaryTypeDisplay = formatBusinessType(primaryType)
      }
    }

    const selectedBusiness: SelectedBusiness = {
      name: place.name,
      google_place_id: place.place_id,
      city: city,
      google_primary_type: primaryType,
      google_primary_type_display: primaryTypeDisplay,
      google_types: place.types || []
    }

    onBusinessSelected(selectedBusiness)
  }

  function formatBusinessType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      searchBusinesses()
    }
  }
</script>

<div class="space-y-4">
  <!-- Hidden map div for PlacesService -->
  <div bind:this={mapDiv} style="display: none;"></div>

  <div>
    <label for="business-search" class="block text-sm font-medium text-gray-700 mb-2">
      Search for your business
    </label>
    <div class="flex space-x-2">
      <input
        id="business-search"
        bind:value={searchQuery}
        onkeydown={handleKeydown}
        type="text"
        placeholder="e.g., Joe's Pizza Dublin"
        class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isSearching}
      />
      <button
        onclick={searchBusinesses}
        disabled={isSearching || !searchQuery.trim()}
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors cursor-pointer"
      >
        {isSearching ? 'Searching...' : 'Search'}
      </button>
    </div>
    <p class="text-xs text-gray-500 mt-1">
      Include your business name and location for best results
    </p>
  </div>

  {#if error}
    <div class="p-3 bg-red-50 border border-red-200 rounded-md">
      <p class="text-sm text-red-800">{error}</p>
    </div>
  {/if}

  {#if searchResults.length > 0}
    <div>
      <h4 class="text-sm font-medium text-gray-700 mb-3">Select your business:</h4>
      <div class="space-y-2 max-h-60 overflow-y-auto">
        {#each searchResults as place}
          <button
            onclick={() => selectBusiness(place)}
            class="w-full text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
          >
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <h5 class="font-medium text-gray-900">{place.name}</h5>
                <p class="text-sm text-gray-600">{place.formatted_address}</p>
                {#if place.types && place.types.length > 0}
                  <div class="mt-1">
                    {#each place.types.slice(0, 3) as type}
                      <span class="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded mr-1">
                        {formatBusinessType(type)}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>
              {#if place.business_status === 'OPERATIONAL'}
                <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                  Active
                </span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="flex justify-end space-x-3 pt-4">
    <button
      onclick={onCancel}
      class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
    >
      Cancel
    </button>
  </div>
</div>
