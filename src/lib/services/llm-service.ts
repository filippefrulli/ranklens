import type { LLMProvider } from '../types'

export interface LLMResponse {
  rankedBusinesses: string[]
  foundBusinessRank: number | null // null if business not found
  foundBusinessName: string | null // the actual name found (might differ slightly)
  responseTimeMs: number
  success: boolean
  error?: string
  totalRequested: number // how many businesses were requested
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
    
    // Only return match if score is above threshold
    if (bestMatch.score >= 0.6) {
      return { rank: bestMatch.rank, foundName: bestMatch.name }
    }
    
    return { rank: null, foundName: null }
  }

  public static async makeRequest(
    provider: LLMProvider,
    query: string,
    businessName: string,
    requestCount: number = 25
  ): Promise<LLMResponse> {
    const startTime = Date.now()
    
    try {
      let rankedBusinesses: string[] = []
      let totalRequested = requestCount
      let foundResult = { rank: null as number | null, foundName: null as string | null }
      
      // First attempt with initial count
      const prompt = this.buildPrompt(query, requestCount)
      
        // Call server-side proxy for provider
        const resp = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: provider.name, prompt, model: 'gpt-5-mini' })
        })
        
        if (!resp.ok) {
          const t = await resp.text()
          throw new Error(`LLM proxy error ${resp.status}: ${t}`)
        }
        
  const { content } = await resp.json()
        
  rankedBusinesses = this.extractBusinessNames(content)
  // Normalize by collapsing near-duplicate names so variants like
  // "Big Bus Tours" vs "Big Bus Tours Dublin" don't count separately.
  rankedBusinesses = this.deduplicateRankedList(rankedBusinesses)
      
      foundResult = this.findBusinessInList(businessName, rankedBusinesses)
      
      if (foundResult.rank) {
      } else {
        rankedBusinesses.forEach((business, index) => {
          const score = this.fuzzyMatch(businessName, business)
        })
      }
      
      const responseTimeMs = Date.now() - startTime
      
      return {
        rankedBusinesses,
        foundBusinessRank: foundResult.rank,
        foundBusinessName: foundResult.foundName,
        responseTimeMs,
        success: true,
        totalRequested
      }
    } catch (error) {
      return {
        rankedBusinesses: [],
        foundBusinessRank: null,
        foundBusinessName: null,
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        totalRequested: requestCount
      }
    }
  }

  private static buildPrompt(query: string, count: number = 25): string {
    return `Provide a ranked list of the top ${count} businesses that best match this query: "${query}"

Strict formatting and naming rules:
- Return ONLY a numbered list of business names (one per line)
- Format each line exactly as: "1. Official Business Name"
- Use the official business name as listed on Google Maps (or the most commonly recognized official name)
- Do not add location qualifiers like city/country/neighborhood unless they are part of the official name
- No additional commentary, addresses, URLs, categories, or descriptions
- Aim for ${count} businesses if possible, in order of best first

Query: ${query}`
  }

  // Provider HTTP calls moved server-side (/api/llm). No direct client calls remain.

  private static extractBusinessNames(content: string): string[] {
    const lines = content.split('\n')
    const businesses: string[] = []

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/m)
      if (match && match[1]) {
        const businessName = match[1].trim()
        businesses.push(businessName)
      }
    }

    return businesses
  }

  // Collapse near-duplicate names in a ranked list while preserving order.
  // Uses a strict threshold so brand + city variants collapse to a single entry.
  private static deduplicateRankedList(names: string[]): string[] {
    const unique: string[] = []

    for (const name of names) {
      const isDup = unique.some(existing => {
        const scoreA = this.fuzzyMatch(existing, name)
        const scoreB = this.fuzzyMatch(name, existing)
        const score = Math.max(scoreA, scoreB)
        // Treat as duplicate if highly similar or contains-based (~0.8)
        return score >= 0.85 || score === 0.8
      })
      if (!isDup) unique.push(name)
    }

    return unique
  }

  public static async runRankingAnalysis(
    providers: LLMProvider[],
    query: string,
    businessName: string,
    attempts: number = 5
  ): Promise<Map<string, LLMResponse[]>> {
    
    const results = new Map<string, LLMResponse[]>()

    for (const provider of providers) {
      if (!provider.is_active) {
        continue
      }

      const providerResults: LLMResponse[] = []
      
      for (let i = 0; i < attempts; i++) {
        
        // Start with 25 businesses, may request more if business not found
        const result = await this.makeRequest(provider, query, businessName, 25)
        providerResults.push(result)
        
        // Add delay between requests to be respectful to APIs
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
      }

      results.set(provider.name, providerResults)
      
      // Longer delay between providers
      if (providers.indexOf(provider) < providers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    return results
  }
}
