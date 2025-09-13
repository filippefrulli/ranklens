import { LLMService } from './llm-service'

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
    console.log('🔄 BusinessNameStandardizationService.standardizeBusinessNames called with:', businessNames)
    
    if (businessNames.length === 0) {
      console.log('⚠️ No business names to standardize')
      return []
    }

    // Check cache first
    const uncachedNames: string[] = []
    const results: BusinessNameStandardization[] = []

    for (const name of businessNames) {
      const cached = this.cache.get(name.toLowerCase().trim())
      if (cached) {
        console.log(`💾 Cache hit for: ${name} -> ${cached}`)
        results.push({
          originalName: name,
          standardizedName: cached,
          confidence: 'high' // Cache hits are high confidence
        })
      } else {
        console.log(`🆕 Cache miss for: ${name}`)
        uncachedNames.push(name)
      }
    }

    if (uncachedNames.length === 0) {
      console.log('✅ All names found in cache')
      return results
    }

    console.log(`🤖 Calling LLM for ${uncachedNames.length} uncached names:`, uncachedNames)

    try {
      // Prepare the prompt for LLM
      const prompt = this.createStandardizationPrompt(uncachedNames)
      console.log('📝 LLM Prompt:', prompt.substring(0, 200) + '...')
      
      // Use the existing LLM service to standardize names
      const response = await LLMService.queryLLM(
        'OpenAI GPT-5',
        'gpt-5-nano',
        prompt,
        'low'
      )
      
      console.log('🤖 LLM Response:', response)

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
      
      console.log(`✅ Standardized ${standardizations.length} business names`)
      return results

    } catch (error) {
      console.error('❌ Error standardizing business names:', error)
      
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
    return `You are a business name standardization expert. Your task is to convert business names to their official Google Business names.

INSTRUCTIONS:
1. For each business name, provide the official Google Business name
2. Remove unnecessary descriptors like "A Luxury Collection Hotel", "Autograph Collection", city names, etc.
3. Keep the core business name that would appear on Google Business listings
4. For hotels, keep "Hotel" if it's part of the official name, remove it if it's just descriptive
5. Maintain brand consistency (e.g., "The Ritz-Carlton" not "Ritz Carlton")
6. If unsure, provide the cleanest, most professional version of the name

BUSINESS NAMES TO STANDARDIZE:
${businessNames.map((name, index) => `${index + 1}. ${name}`).join('\n')}

RESPONSE FORMAT (JSON):
{
  "standardizations": [
    {
      "original": "The Shelbourne, A Luxury Collection Hotel, Dublin",
      "standardized": "The Shelbourne",
      "confidence": "high"
    }
  ]
}

Respond with valid JSON only. Confidence should be "high" for well-known brands, "medium" for likely matches, "low" for uncertain cases.`
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
      console.error('❌ Error parsing standardization response:', error)
      
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