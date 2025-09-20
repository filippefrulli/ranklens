import type { Business } from '../types'
import { LLMService } from './llm-service'
import { LLMProviderId, DEFAULT_MODELS } from '$lib/constants/llm'
import { buildBusinessResearchPrompt, buildQuerySuggestionsPrompt } from './prompt-templates'

interface QuerySuggestion {
  text: string
}

// Narrative research is now plain text (two concise paragraphs) instead of structured JSON
type BusinessResearchNarrative = string

export class QuerySuggestionService {
  private static readonly MAX_RETRIES = 3
  private static readonly TIMEOUT_MS = 150000 // 15 seconds

  static async generateQuerySuggestions(business: Business): Promise<QuerySuggestion[]> {
    try {
      // First, research the business to understand its characteristics
  const researchNarrative = await this.researchBusinessWithRetry(business)

  // Then generate suggestions based on the narrative research
  const prompt = this.buildPrompt(business, researchNarrative)
  const content = await this.queryLLMWithRetry(LLMProviderId.OPENAI, DEFAULT_MODELS.OPENAI, prompt, 'low')

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
    reasoning: string,
    attempt: number = 1
  ): Promise<string> {
    try {
      console.log(`LLM query attempt ${attempt}/${this.MAX_RETRIES}`)
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.TIMEOUT_MS)
      })
      
      const llmPromise = LLMService.queryLLM(provider, model, prompt, reasoning)
      
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
        return this.queryLLMWithRetry(provider, model, prompt, reasoning, attempt + 1)
      }
      
      throw new Error(`LLM query failed after ${this.MAX_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private static async researchBusinessWithRetry(business: Business, attempt: number = 1): Promise<BusinessResearchNarrative> {
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

  private static async researchBusiness(business: Business): Promise<BusinessResearchNarrative> {
    const researchPrompt = buildBusinessResearchPrompt({
      name: business.name,
      city: business.city,
      googlePrimaryTypeDisplay: business.google_primary_type_display
    })

    try {
  const researchContent = await this.queryLLMWithRetry(LLMProviderId.OPENAI, DEFAULT_MODELS.OPENAI, researchPrompt, 'medium')
      
      if (!researchContent) {
        throw new Error('No research content received')
      }

  return researchContent.trim()
    } catch (error) {
      console.error('Error researching business:', error)
      throw error // Let the retry logic handle this
    }
  }

  private static createFallbackResearch(business: Business): BusinessResearchNarrative {
    const type = (business.google_primary_type_display || 'business').toLowerCase()
    return `${business.name} is a ${type} likely operating at a mid-range price point and serving general customers in ${(business.city || 'its local area')}. Its positioning cannot be fully inferred due to limited data.`
      + ` It probably focuses on delivering consistent core value with standard features while aiming to attract repeat local or destination-driven interest.`
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

  private static buildPrompt(business: Business, researchNarrative: BusinessResearchNarrative): string {
    const mainCity = this.extractMainCity(business.city || '')
    return buildQuerySuggestionsPrompt({
      businessName: business.name,
      researchNarrative,
      mainCity
    })
  }

  private static parseQuerySuggestions(content: string): QuerySuggestion[] {
    const cleaned = content.replace(/```json\n?/gi, '').replace(/```/g, '').trim()
    // Try strict JSON first
    try {
      const parsed = JSON.parse(cleaned)
      if (parsed && Array.isArray(parsed.suggestions)) {
        const arr = parsed.suggestions
          .map((s: any) => (typeof s === 'string' ? s : s?.text || ''))
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
          .slice(0, 6)
        if (arr.length > 0) {
          return arr.map((text: string) => ({ text }))
        }
      }
    } catch (e) {
      // fall through to line-based parsing
    }

    // Fallback: treat as raw lines
    const lines = cleaned.split(/\r?\n/)
      .map(l => l.trim().replace(/^[-*\d+.\)]\s*/, ''))
      .filter(l => l.length > 0 && !l.startsWith('{') && !l.startsWith('"suggestions"'))

    const queries = lines.slice(0, 6).map(text => ({ text }))
    if (queries.length === 0) {
      throw new Error('Failed to parse query suggestions (no JSON or lines)')
    }
    return queries
  }
}
