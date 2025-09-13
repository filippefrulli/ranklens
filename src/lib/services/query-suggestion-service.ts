import type { Business } from '../types'
import { LLMService } from './llm-service'

interface QuerySuggestion {
  text: string
}

interface BusinessResearch {
  category: string
  priceRange: string
  keyAmenities: string[]
  targetAudience: string
  uniqueFeatures: string[]
  businessType: string
}

export class QuerySuggestionService {
  private static readonly MAX_RETRIES = 3
  private static readonly TIMEOUT_MS = 10000 // 10 seconds

  static async generateQuerySuggestions(business: Business): Promise<QuerySuggestion[]> {
    try {
      // First, research the business to understand its characteristics
      const research = await this.researchBusinessWithRetry(business)
      
      // Then generate suggestions based on the research
      const prompt = this.buildPrompt(business, research)
      const content = await this.queryLLMWithRetry('Google Gemini', 'gemini-2.5-flash-lite', prompt, 'high')

      if (!content) {
        throw new Error('No content received from LLM')
      }

      return this.parseQuerySuggestions(content)
    } catch (error) {
      console.error('Error generating query suggestions:', error)
      throw new Error('Failed to generate query suggestions')
    }
  }

  private static async queryLLMWithRetry(
    provider: string, 
    model: string, 
    prompt: string, 
    quality: string,
    attempt: number = 1
  ): Promise<string> {
    try {
      console.log(`LLM query attempt ${attempt}/${this.MAX_RETRIES}`)
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.TIMEOUT_MS)
      })
      
      const llmPromise = LLMService.queryLLM(provider, model, prompt, quality)
      
      const content = await Promise.race([llmPromise, timeoutPromise])
      
      if (!content) {
        throw new Error('No content received from LLM')
      }
      
      return content
    } catch (error) {
      console.error(`LLM query attempt ${attempt} failed:`, error)
      
      if (attempt < this.MAX_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * 1000 // Exponential backoff: 1s, 2s, 4s
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.queryLLMWithRetry(provider, model, prompt, quality, attempt + 1)
      }
      
      throw new Error(`LLM query failed after ${this.MAX_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private static async researchBusinessWithRetry(business: Business, attempt: number = 1): Promise<BusinessResearch> {
    try {
      console.log(`Business research attempt ${attempt}/${this.MAX_RETRIES}`)
      return await this.researchBusiness(business)
    } catch (error) {
      console.error(`Business research attempt ${attempt} failed:`, error)
      
      if (attempt < this.MAX_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * 1000 // Exponential backoff: 1s, 2s, 4s
        console.log(`Retrying business research in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.researchBusinessWithRetry(business, attempt + 1)
      }
      
      console.log('All business research attempts failed, using fallback research')
      return this.createFallbackResearch(business)
    }
  }

  private static async researchBusiness(business: Business): Promise<BusinessResearch> {
    const researchPrompt = `Research and analyze the business "${business.name}" to understand its characteristics and positioning.

Business Details:
- Name: ${business.name}
- Location: ${business.city || 'Not specified'}
- Business Type: ${business.google_primary_type_display || 'Not specified'}
- Google Types: ${business.google_types ? JSON.stringify(business.google_types) : 'Not specified'}

Please analyze this business and provide insights about:

1. CATEGORY & POSITIONING: Is this a luxury, mid-range, budget, boutique, chain, independent business?
2. PRICE RANGE: Likely pricing tier (budget, affordable, mid-range, upscale, luxury)
3. KEY AMENITIES: What amenities/features would this type of business likely offer?
4. TARGET AUDIENCE: Who are the typical customers (business travelers, families, couples, tourists, locals)?
5. UNIQUE FEATURES: What might make this business stand out or be special?
6. BUSINESS TYPE: More specific classification beyond the Google type

Use your knowledge about businesses with similar names, locations, and types to make educated inferences.

Format your response as JSON:
{
  "category": "specific category like 'boutique hotel', 'budget accommodation', 'luxury resort'",
  "priceRange": "budget|affordable|mid-range|upscale|luxury",
  "keyAmenities": ["amenity1", "amenity2", "amenity3"],
  "targetAudience": "description of typical customers",
  "uniqueFeatures": ["feature1", "feature2"],
  "businessType": "more specific business type"
}`

    try {
      const researchContent = await this.queryLLMWithRetry('Google Gemini', 'gemini-2.5-flash-lite', researchPrompt, 'high')
      
      if (!researchContent) {
        throw new Error('No research content received')
      }

      return this.parseBusinessResearch(researchContent)
    } catch (error) {
      console.error('Error researching business:', error)
      throw error // Let the retry logic handle this
    }
  }

  private static parseBusinessResearch(content: string): BusinessResearch {
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleanContent)
      
      return {
        category: parsed.category || 'general business',
        priceRange: parsed.priceRange || 'mid-range',
        keyAmenities: Array.isArray(parsed.keyAmenities) ? parsed.keyAmenities : [],
        targetAudience: parsed.targetAudience || 'general customers',
        uniqueFeatures: Array.isArray(parsed.uniqueFeatures) ? parsed.uniqueFeatures : [],
        businessType: parsed.businessType || 'service business'
      }
    } catch (error) {
      console.error('Error parsing business research:', error)
      return {
        category: 'general business',
        priceRange: 'mid-range',
        keyAmenities: [],
        targetAudience: 'general customers',
        uniqueFeatures: [],
        businessType: 'service business'
      }
    }
  }

  private static createFallbackResearch(business: Business): BusinessResearch {
    const businessType = business.google_primary_type_display?.toLowerCase() || ''
    
    if (businessType.includes('hotel') || businessType.includes('accommodation') || businessType.includes('lodging')) {
      return {
        category: 'hotel',
        priceRange: 'mid-range',
        keyAmenities: ['wifi', 'breakfast', 'parking', 'concierge'],
        targetAudience: 'travelers and tourists',
        uniqueFeatures: ['comfortable rooms', 'good location'],
        businessType: 'accommodation'
      }
    }
    
    if (businessType.includes('restaurant') || businessType.includes('dining')) {
      return {
        category: 'restaurant',
        priceRange: 'mid-range',
        keyAmenities: ['dine-in', 'takeout', 'reservations'],
        targetAudience: 'diners and food lovers',
        uniqueFeatures: ['quality food', 'good service'],
        businessType: 'dining'
      }
    }
    
    return {
      category: 'general business',
      priceRange: 'mid-range',
      keyAmenities: [],
      targetAudience: 'general customers',
      uniqueFeatures: [],
      businessType: 'service business'
    }
  }

  private static extractMainCity(cityValue: string): string {
    if (!cityValue) return 'the area'
    
    // Handle Dublin postal codes (D01, D02, etc.)
    if (cityValue.match(/^D\d{1,2}$/i)) {
      return 'Dublin'
    }
    
    // Handle "City, County" format
    if (cityValue.includes(',')) {
      return cityValue.split(',')[0].trim()
    }
    
    // Handle postal codes or area codes at the end
    const withoutPostcode = cityValue.replace(/\s+\w{1,3}\s*\d+\w*$/i, '').trim()
    if (withoutPostcode.length > 0) {
      return withoutPostcode
    }
    
    return cityValue
  }

  private static buildPrompt(business: Business, research: BusinessResearch): string {
    // Extract the main city from postal code or detailed location
    const mainCity = this.extractMainCity(business.city || '')
    
    return `Generate 5 natural queries that customers would ask an AI assistant when looking for "${business.name}" or similar services.

Business: ${business.name} in ${mainCity}
Type: ${research.category} (${research.priceRange})
Key amenities: ${research.keyAmenities.slice(0, 3).join(', ')}
Target customers: ${research.targetAudience}

Requirements:
1. Use business research to make queries realistic and relevant
2. Mix 3 SHORT queries (6-8 words) + 2 DETAILED queries (10-15 words)
3. Use conversational language: "I need...", "Can you recommend...", "What are the best..."
4. Include price positioning (${research.priceRange}) and popular amenities
5. Vary locations: some with "${mainCity}", some without, avoid repeating same area
6. Every query should be about a single thing, meaning ask for a hotel or a restaurant, never hotels or restaurants in the plural.
7. Every query should always include a location reference.

Examples:
SHORT: "I need luxury hotels in Dublin", "Can you recommend budget accommodation?"
DETAILED: "I'm looking for family hotels with pool in Dublin", "I need affordable accommodation for business trip"

Format as JSON:
{
  "suggestions": [
    "query 1",
    "query 2", 
    "query 3",
    "query 4",
    "query 5"
  ]
}`
  }

  private static parseQuerySuggestions(content: string): QuerySuggestion[] {
    try {
      // Clean the content to handle potential markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      const parsed = JSON.parse(cleanContent)
      
      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        throw new Error('Invalid response format')
      }

      const results = parsed.suggestions.map((suggestion: any) => ({
        text: typeof suggestion === 'string' ? suggestion : suggestion.text || ''
      })).filter((s: QuerySuggestion) => s.text.trim().length > 0)
      
      return results
      
    } catch (error) {
      console.error('Error parsing query suggestions:', error)
      console.error('Content:', content)
      
      // Fallback: try to extract queries using regex if JSON parsing fails
      const lines = content.split('\n')
      const queries: QuerySuggestion[] = []
      
      for (const line of lines) {
        const match = line.match(/"([^"]+)"/)
        if (match && match[1].length > 10) { // Reasonable query length
          queries.push({
            text: match[1]
          })
        }
      }
      
      if (queries.length > 0) {
        return queries.slice(0, 5) // Limit to 5
      }
      
      throw new Error('Failed to parse query suggestions')
    }
  }
}
