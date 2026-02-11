import { LLMService } from './llm-service'
import { DEFAULT_MODELS, LLMProviderId, PROVIDER_DISPLAY_NAMES } from '$lib/constants/llm'

export interface BusinessNameStandardization {
  originalName: string
  standardizedName: string
  confidence: 'high' | 'medium' | 'low'
}

export class BusinessNameStandardizationService {
  private static cache = new Map<string, string>()

  /**
   * Standardize a list of business names to their official Google business names
   * Uses LLM to intelligently group similar names and find canonical versions
   */
  static async standardizeBusinessNames(businessNames: string[]): Promise<BusinessNameStandardization[]> {
    
    if (businessNames.length === 0) {
      console.log('[Service] BusinessNameStandardization: No names to standardize')
      return []
    }

    // Check cache first
    const uncachedNames: string[] = []
    const results: BusinessNameStandardization[] = []

    for (const name of businessNames) {
      const cached = this.cache.get(name.toLowerCase().trim())
      if (cached) {
        results.push({
          originalName: name,
          standardizedName: cached,
          confidence: 'high' // Cache hits are high confidence
        })
      } else {
        uncachedNames.push(name)
      }
    }

    if (uncachedNames.length === 0) {
      console.log('[Service] BusinessNameStandardization: All names from cache')
      return results
    }

    console.log('[Service] BusinessNameStandardization: Standardizing names', { count: uncachedNames.length })

    try {
      // Prepare the prompt for LLM
      const prompt = this.createStandardizationPrompt(uncachedNames)
      
      // Use the existing LLM service to standardize names
      const response = await LLMService.queryLLM(
        LLMProviderId.OPENAI,
        DEFAULT_MODELS[LLMProviderId.OPENAI],
        prompt,
        'low'
      )

      // Parse the LLM response
      const standardizations = this.parseStandardizationResponse(response, uncachedNames)
      
      // Cache the results
      for (const standardization of standardizations) {
        this.cache.set(
          standardization.originalName.toLowerCase().trim(),
          standardization.standardizedName
        )
      }

      results.push(...standardizations)
      
      console.log('[Service] BusinessNameStandardization: Success', { 
        standardized: standardizations.length,
        provider: PROVIDER_DISPLAY_NAMES[LLMProviderId.OPENAI]
      })
      return results

    } catch (error: any) {
      console.error('[Service] BusinessNameStandardization: Error', { error: error?.message || 'Unknown error' })
      
      // Fallback: return original names if LLM fails
      const fallbackResults = uncachedNames.map(name => ({
        originalName: name,
        standardizedName: name,
        confidence: 'low' as const
      }))
      
      results.push(...fallbackResults)
      return results
    }
  }

  /**
   * Create a prompt for the LLM to standardize business names
   */
  private static createStandardizationPrompt(businessNames: string[]): string {
    return `You are a business name standardization expert. Your task is to standardize business names to their commonly recognized forms while preserving brand identity.

INSTRUCTIONS:
1. Preserve the core brand name with sufficient context for recognition
2. Remove only redundant descriptors: city/location names, "A Luxury Collection", "Autograph Collection", etc.
3. Keep essential qualifiers that are part of the brand identity:
   - Keep "Hotel", "Restaurant", "Bar", etc. if it's part of the official name
   - Keep "The" if it's part of the brand (e.g., "The Shelbourne Hotel" not just "Shelbourne")
   - Keep distinguishing words that differentiate locations (e.g., "Merrion Hotel" not just "Merrion")
4. Maintain consistent formatting:
   - "The Shelbourne Hotel" (not "The Shelbourne, Dublin" or "Shelbourne Hotel, The")
   - "The Merrion Hotel" (not "Merrion" or "The Merrion, Dublin")
5. If a business name is already clean and recognizable, keep it as-is
6. Brand examples:
   - "The Shelbourne, A Luxury Collection Hotel, Dublin" → "The Shelbourne Hotel"
   - "The Merrion Hotel Dublin" → "The Merrion Hotel"
   - "Wilde Restaurant at The Westbury" → "Wilde Restaurant"
   - "Chapter One Restaurant" → "Chapter One Restaurant"

BUSINESS NAMES TO STANDARDIZE:
${businessNames.map((name, index) => `${index + 1}. ${name}`).join('\n')}

RESPONSE FORMAT (JSON):
{
  "standardizations": [
    {
      "original": "The Shelbourne, A Luxury Collection Hotel, Dublin",
      "standardized": "The Shelbourne Hotel",
      "confidence": "high",
      "reasoning": "Removed luxury collection descriptor and city name, kept hotel designation"
    }
  ]
}

Respond with valid JSON only. Confidence should be "high" for well-known brands with clear standardization, "medium" for good matches with minor uncertainty, "low" for ambiguous cases.`
  }

  /**
   * Parse the LLM response and extract standardizations
   */
  private static parseStandardizationResponse(
    response: string, 
    originalNames: string[]
  ): BusinessNameStandardization[] {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      if (!parsed.standardizations || !Array.isArray(parsed.standardizations)) {
        throw new Error('Invalid response format')
      }

      const results: BusinessNameStandardization[] = []
      
      // Map LLM results back to original names
      for (const standardization of parsed.standardizations) {
        if (standardization.original && standardization.standardized) {
          results.push({
            originalName: standardization.original,
            standardizedName: standardization.standardized.trim(),
            confidence: standardization.confidence || 'medium'
          })
        }
      }

      // Ensure we have results for all original names
      for (const originalName of originalNames) {
        const found = results.find(r => r.originalName === originalName)
        if (!found) {
          results.push({
            originalName,
            standardizedName: originalName,
            confidence: 'low'
          })
        }
      }

      return results

    } catch (error) {
      console.error('[Service] BusinessNameStandardization: Parse error', { error })
      
      // Fallback: return original names
      return originalNames.map(name => ({
        originalName: name,
        standardizedName: name,
        confidence: 'low' as const
      }))
    }
  }

  /**
   * Clear the cache (useful for testing or when business data changes)
   */
  static clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; entries: Array<{ original: string; standardized: string }> } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([original, standardized]) => ({
        original,
        standardized
      }))
    }
  }
}