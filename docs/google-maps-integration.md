# Google Maps API Integration Guide

## Overview
Users must search and select their business through Google Maps API during registration to ensure data accuracy and prevent fake businesses.

## Required Google APIs
1. **Places API (New)** - For business search and details
2. **Maps JavaScript API** - For interactive map display (optional)

## Setup Steps

### 1. Enable Google APIs
```bash
# In Google Cloud Console, enable:
# - Places API (New)
# - Maps JavaScript API (optional)
```

### 2. Environment Variables
Add to your `.env` file:
```env
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### 3. Business Registration Flow

#### Step 1: Business Search
```typescript
// Use Places API Text Search
const searchBusinesses = async (query: string, location?: string) => {
  const response = await fetch(
    `https://places.googleapis.com/v1/places:searchText`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.businessStatus,places.primaryType,places.primaryTypeDisplayName,places.types'
      },
      body: JSON.stringify({
        textQuery: query,
        locationBias: location ? {
          circle: {
            center: location,
            radius: 5000 // 5km radius
          }
        } : undefined
      })
    }
  );
  
  const data = await response.json();
  return data.places;
};
```

#### Step 2: Get Detailed Business Info
```typescript
// Get full business details using Place ID
const getBusinessDetails = async (placeId: string) => {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        'X-Goog-Api-Key': import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,location,rating,userRatingCount,businessStatus,websiteUri,internationalPhoneNumber,googleMapsUri,primaryType,primaryTypeDisplayName,types'
      }
    }
  );
  
  const place = await response.json();
  
  // Transform to database format
  return {
    google_place_id: place.id,
    name: place.displayName.text,
    formatted_address: place.formattedAddress,
    city: extractCity(place.addressComponents),
    google_primary_type: place.primaryType,
    google_primary_type_display: place.primaryTypeDisplayName?.text,
    google_types: place.types,
    google_maps_url: place.googleMapsUri
  };
};
```

#### Step 3: Address Component Extraction
```typescript
const extractAddressComponent = (components: any[], type: string) => {
  const component = components.find(c => c.types.includes(type));
  return component?.longText || component?.shortText || null;
};

const extractStreetAddress = (components: any[]) => {
  const streetNumber = extractAddressComponent(components, 'street_number');
  const route = extractAddressComponent(components, 'route');
  return [streetNumber, route].filter(Boolean).join(' ');
};

const extractCity = (components: any[]) => 
  extractAddressComponent(components, 'locality') ||
  extractAddressComponent(components, 'sublocality_level_1');

const extractState = (components: any[]) =>
  extractAddressComponent(components, 'administrative_area_level_1');

const extractPostalCode = (components: any[]) =>
  extractAddressComponent(components, 'postal_code');

const extractCountry = (components: any[]) =>
  extractAddressComponent(components, 'country');
```

## Business Registration UI Flow

### 1. Search Interface
```svelte
<script lang="ts">
  let searchQuery = '';
  let searchResults = [];
  let selectedBusiness = null;
  
  const handleSearch = async () => {
    if (searchQuery.length < 3) return;
    searchResults = await searchBusinesses(searchQuery);
  };
  
  const selectBusiness = async (place) => {
    selectedBusiness = await getBusinessDetails(place.id);
  };
</script>

<div class="business-search">
  <input 
    bind:value={searchQuery}
    on:input={handleSearch}
    placeholder="Search for your business..."
  />
  
  {#if searchResults.length > 0}
    <div class="search-results">
      {#each searchResults as place}
        <button 
          class="business-option"
          on:click={() => selectBusiness(place)}
        >
          <h3>{place.displayName.text}</h3>
          <p>{place.formattedAddress}</p>
          <span>★ {place.rating} ({place.userRatingCount} reviews)</span>
        </button>
      {/each}
    </div>
  {/if}
  
  {#if selectedBusiness}
    <div class="selected-business">
      <h2>Selected Business</h2>
      <p><strong>{selectedBusiness.name}</strong></p>
      <p>{selectedBusiness.formatted_address}</p>
      <p>Rating: ★ {selectedBusiness.google_rating} ({selectedBusiness.google_review_count} reviews)</p>
      
      <button on:click={createProject}>
        Create Project for This Business
      </button>
    </div>
  {/if}
</div>
```

### 2. Create Business & Project
```typescript
const createProject = async () => {
  try {
    // First create/get the business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .upsert(selectedBusiness, { 
        onConflict: 'google_place_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();
    
    if (businessError) throw businessError;
    
    // Then create the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: `${business.name} - Ranking Analysis`,
        business_id: business.id,
        user_id: user.id
      })
      .select()
      .single();
    
    if (projectError) throw projectError;
    
    // Redirect to project dashboard
    goto(`/projects/${project.id}`);
    
  } catch (error) {
    console.error('Error creating project:', error);
  }
};
```

## Benefits of This Approach

### ✅ **Data Quality**
- Ensures all businesses exist and are legitimate
- Standardized address formatting
- Consistent business information
- Real-time business status (open/closed)

### ✅ **Rich Business Data**
- Google ratings and review counts
- Verified contact information
- Precise location coordinates
- Business hours and status

### ✅ **Prevents Fraud**
- No fake businesses can be registered
- Users must select from verified Google listings
- Business ownership can be verified later if needed

### ✅ **Better Analytics**
- Can match business names more accurately in LLM responses
- Location-based query optimization
- Cross-reference with Google ratings/reviews

## Cost Considerations
- Text Search: $32 per 1000 requests
- Place Details: $17 per 1000 requests
- Budget for ~$0.05 per business registration

## Rate Limiting
- Implement debouncing for search (500ms delay)
- Cache search results client-side
- Consider server-side caching for popular searches
