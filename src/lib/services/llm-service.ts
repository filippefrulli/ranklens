import type { LLMProvider } from '../types'
import { env } from '$env/dynamic/private'
import { GoogleGenAI } from '@google/genai'
import { buildRankingPrompt, buildStandardizationPrompt } from './prompt-templates'
import { normalizeProvider, LLMProviderId, getDefaultModel } from '$lib/constants/llm'

export interface LLMResponse {
  rankedBusinesses: string[]
  foundBusinessRank: number | null // null if business not found
  foundBusinessName: string | null // the actual name found (might differ slightly)
  responseTimeMs: number
  success: boolean
  error?: string
  totalRequested: number // how many businesses were requested
}

function withTimeout<T>(promise: Promise<T>, ms = 60000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('LLM request timed out')), ms)
    promise
      .then((res) => {
        clearTimeout(id)
        resolve(res)
      })
      .catch((err) => {
        clearTimeout(id)
        reject(err)
      })
  })
}

export class LLMService {
  // Fuzzy matching utility to find business in results
  private static fuzzyMatch(target: string, candidate: string): number {
    const targetLower = target.toLowerCase().trim()
    const candidateLower = candidate.toLowerCase().trim()
    
    // Exact match
    if (targetLower === candidateLower) return 1.0
    
    // Contains match
    if (candidateLower.includes(targetLower) || targetLower.includes(candidateLower)) {
      return 0.8
    }
    
    // Simple word overlap scoring
    const targetWords = targetLower.split(/\s+/)
    const candidateWords = candidateLower.split(/\s+/)
    
    let matchingWords = 0
    for (const targetWord of targetWords) {
      if (candidateWords.some(cw => cw.includes(targetWord) || targetWord.includes(cw))) {
        matchingWords++
      }
    }
    
    const score = matchingWords / Math.max(targetWords.length, candidateWords.length)
    return score >= 0.6 ? score : 0 // Only consider matches above 60%
  }

  private static findBusinessInList(businessName: string, rankedList: string[]): {
    rank: number | null,
    foundName: string | null
  } {
    let bestMatch = { score: 0, rank: -1, name: '' }
    
    for (let i = 0; i < rankedList.length; i++) {
      const score = this.fuzzyMatch(businessName, rankedList[i])
      if (score > bestMatch.score) {
        bestMatch = { score, rank: i + 1, name: rankedList[i] }
      }
    }
    
    if (bestMatch.score > 0) {
      return { rank: bestMatch.rank, foundName: bestMatch.name }
    }
    
    return { rank: null, foundName: null }
  }

  // Public method for general LLM queries
  public static async queryLLM(providerName: string, model: string, prompt: string, reasoning: string): Promise<string> {
    const { id, model: resolvedModel, displayName } = normalizeProvider(providerName, model)
    try {
      switch (id) {
        case LLMProviderId.OPENAI:
          return await this.callOpenAI(prompt, resolvedModel, reasoning)
        case LLMProviderId.GEMINI:
          return await this.callGemini(prompt, resolvedModel)
        default:
          throw new Error(`Unsupported LLM provider: ${displayName}`)
      }
    } catch (error) {
      console.error(`Error querying ${displayName}:`, error)
      throw error
    }
  }

  // buildPrompt removed: use buildRankingPrompt from prompt-templates

  private static extractBusinessNames(text: string): string[] {
    const lines = text.split('\n')
    const businesses: string[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Match numbered list patterns: "1. Business Name" or "1) Business Name"
      const match = trimmed.match(/^\d+[\.\)]\s*(.+)$/)
      if (match && match[1]) {
        const businessName = match[1].trim()
        if (businessName && businessName.length > 0) {
          businesses.push(businessName)
        }else{
          console.warn("Extracted business name is empty or invalid:", trimmed)
        }
      }
    }
    
    return businesses
  }

  private static normalizeBusinessName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      // Remove common prefixes/suffixes
      .replace(/^(the\s+)/i, '')
      .replace(/(\s+ltd\.?|\s+llc\.?|\s+inc\.?|\s+corp\.?|\s+co\.?)$/i, '')
      // Handle plural forms by removing trailing 's' if it makes sense
      .replace(/(\w)s$/, '$1')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim()
  }

  private static deduplicateRankedList(names: string[]): string[] {
    const seen = new Map<string, string>() // normalized -> original
    const result: string[] = []
    
    for (const name of names) {
      const normalized = this.normalizeBusinessName(name)
      
      if (!seen.has(normalized)) {
        seen.set(normalized, name)
        result.push(name)
      } else {
        // If we have a duplicate, prefer the version without "The" prefix
        const existing = seen.get(normalized)!
        if (existing.toLowerCase().startsWith('the ') && !name.toLowerCase().startsWith('the ')) {
          // Replace the existing one with the non-"The" version
          const index = result.indexOf(existing)
          if (index !== -1) {
            result[index] = name
            seen.set(normalized, name)
          }
        }
      }
    }
    
    return result
  }

  // Post-process business names with Gemini to standardize to Google Maps names
  private static async standardizeBusinessNames(businessNames: string[], userBusinessName: string): Promise<string[]> {
    if (businessNames.length === 0) return businessNames

    // Skip standardization if we have too many names to avoid overwhelming the API
    if (businessNames.length > 50) {
      console.log('Skipping Gemini standardization for large list, using original names')
      return businessNames
    }

    try {
  const standardizedText = await this.callGemini(
    buildStandardizationPrompt({ productNames: businessNames, userProductName: userBusinessName })
  )
      
      // Extract standardized names
      const standardizedNames = standardizedText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      // We might get fewer results than we sent if Gemini removed duplicates/invalid businesses
      // This is expected and desirable
      if (standardizedNames.length > 0) {
        console.log(`✅ Gemini standardization successful: ${businessNames.length} → ${standardizedNames.length} names`)
        return standardizedNames
      } else {
        console.warn('⚠️ Gemini standardization returned no results, using original names')
        return businessNames
      }
    } catch (error: any) {
      // Handle different types of errors with appropriate logging
      if (error?.status === 503 || error?.message?.includes('overloaded')) {
        console.warn('⚠️ Gemini API temporarily overloaded, using original business names')
      } else if (error?.status === 429) {
        console.warn('⚠️ Gemini API rate limit exceeded, using original business names')
      } else if (error?.status === 401 || error?.message?.includes('API key')) {
        console.warn('⚠️ Gemini API authentication failed, using original business names')
      } else {
        console.warn('⚠️ Gemini standardization failed with unexpected error, using original names:', error?.message || error)
      }
      
      // Always fall back to original names to ensure the ranking continues
      return businessNames
    }
  }

  // Direct API calls (server-only)
  private static async callOpenAI(prompt: string, model: string, reasoning: string): Promise<string> {
    const apiKey = env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OpenAI API key not configured')
    
    const payload: Record<string, any> = {
      model: model,
      input: prompt,
      reasoning: { effort: reasoning }
    }

    const resp = await withTimeout(
      fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
    )

    if (!resp.ok) {
      const errorText = await resp.text()
      console.error('OpenAI API error:', resp.status, errorText)
      throw new Error(`OpenAI error ${resp.status}: ${errorText}`)
    }
    
    const data = await resp.json()
    
    // The /v1/responses endpoint returns a complex nested structure
    // The actual text content is in output[1].content[0].text (based on the response structure you provided)
    let content = ''
    
    if (data?.output && Array.isArray(data.output)) {
      // Find the message output (type: "message")
      const messageOutput = data.output.find((item: any) => item.type === 'message')
      if (messageOutput?.content && Array.isArray(messageOutput.content)) {
        // Find the text content (type: "output_text")
        const textContent = messageOutput.content.find((item: any) => item.type === 'output_text')
        if (textContent?.text) {
          content = textContent.text
        }
      }
    }
    
    // Fallback to other possible fields if the above structure doesn't work
    if (!content) {
      content = data?.output || data?.response || data?.content || data?.text || ''
    }
    
    return content
  }

  private static async callGemini(prompt: string, model?: string): Promise<string> {
    const apiKey = env.GEMINI_API_KEY
    if (!apiKey) throw new Error('Gemini API key not configured')
    const ai = new GoogleGenAI({ apiKey })
    const resp = await withTimeout(
      ai.models.generateContent({
        model: model || getDefaultModel(LLMProviderId.GEMINI),
        contents: prompt,
      })
    )
    return resp.text || ''
  }

  // Calculate truncation limit based on user business rank
  private static calculateTruncationLimit(userRank: number | null, totalBusinesses: number): number {
    if (!userRank) {
      // If user business not found, return all businesses
      return totalBusinesses
    }
    
    // Round up to next multiple of 5
    const roundedRank = Math.ceil(userRank / 5) * 5
    
    // Don't exceed the total number of businesses
    return Math.min(roundedRank, totalBusinesses)
  }

  // Main method for making LLM requests (server-only)
  public static async makeRequest(
    provider: LLMProvider,
    query: string,
    businessName: string,
    requestCount: number = 25
  ): Promise<LLMResponse> {
    const startTime = Date.now()
    console.log(`🤖 ${provider.name} request: "${query}" for "${businessName}"`)
    
    try {
  const prompt = buildRankingPrompt({ query, userProductName: businessName, count: requestCount })
      let content = ''
      
      // Normalize provider name & get canonical model
      const { id, model: canonicalModel, displayName } = normalizeProvider(provider.name)

      switch (id) {
        case LLMProviderId.OPENAI:
          content = await this.callOpenAI(prompt, canonicalModel, 'low')
          break
        case LLMProviderId.GEMINI:
          content = await this.callGemini(prompt, canonicalModel)
          break
        default:
          throw new Error(`Unsupported provider: ${provider.name}`)
      }
      
      const rawBusinessNames = this.deduplicateRankedList(this.extractBusinessNames(content))
      
      // Standardize business names using Gemini
      const standardizedBusinesses = await this.standardizeBusinessNames(rawBusinessNames, businessName)
      
      // Find user business in the full list first
      const foundResult = this.findBusinessInList(businessName, standardizedBusinesses)
      
      // Calculate truncation limit based on user business rank
      const truncationLimit = this.calculateTruncationLimit(foundResult.rank, standardizedBusinesses.length)
      
      // Truncate the results to only include businesses up to the limit
      const rankedBusinesses = standardizedBusinesses.slice(0, truncationLimit)

      const responseTime = Date.now() - startTime
  console.log(`✅ ${provider.name} → ${rankedBusinesses.length} businesses (rank: ${foundResult.rank || 'n/a'}) in ${responseTime}ms`)
      
      return {
        rankedBusinesses,
        foundBusinessRank: foundResult.rank,
        foundBusinessName: foundResult.foundName,
        responseTimeMs: responseTime,
        success: true,
        totalRequested: requestCount
      }
      
    } catch (err) {
      const responseTime = Date.now() - startTime
  console.error(`❌ ${provider.name} failed: ${err instanceof Error ? err.message : err} (${responseTime}ms)`)
      
      return {
        rankedBusinesses: [],
        foundBusinessRank: null,
        foundBusinessName: null,
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        totalRequested: requestCount
      }
    }
  }
}
