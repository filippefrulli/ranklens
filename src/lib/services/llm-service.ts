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
      
      const response = await this.callProvider(provider, prompt)
      
      const responseText = await response.text()
      console.log(`📄 Raw response text from ${provider.name}:`, responseText)
      
      // Re-create response for parsing
      const mockResponse = new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
      
      rankedBusinesses = await this.parseResponse(mockResponse, provider.name)
      
      foundResult = this.findBusinessInList(businessName, rankedBusinesses)
      
      if (foundResult.rank) {
        console.log(`✅ Found match: "${foundResult.foundName}" at rank ${foundResult.rank}`)
      } else {
        rankedBusinesses.forEach((business, index) => {
          const score = this.fuzzyMatch(businessName, business)
          if (score > 0) {
            console.log(`  ${index + 1}. "${business}" - score: ${score.toFixed(2)}`)
          }
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
    return `Please provide a ranked list of the top ${count} businesses that best match this query: "${query}"

Requirements:
- Return ONLY a numbered list of business names
- List them in order of relevance/quality (best first)
- Include ${count} businesses if possible
- Format each as: "1. Business Name"
- No additional commentary, explanations, or text
- Focus on actual, real businesses

Query: ${query}`
  }

  private static async callProvider(provider: LLMProvider, prompt: string): Promise<Response> {
    switch (provider.name) {
      case 'OpenAI GPT-5':
        return this.callOpenAI(prompt)
      case 'Anthropic Claude':
        return this.callAnthropic(prompt)
      case 'Google Gemini':
        return this.callGemini(prompt)
      case 'Perplexity AI':
        return this.callPerplexity(prompt)
      default:
        throw new Error(`Unsupported LLM provider: ${provider.name}`)
    }
  }

  private static async callOpenAI(prompt: string): Promise<Response> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) throw new Error('OpenAI API key not configured')

    return fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: prompt
      })
    })
  }

  private static async callAnthropic(prompt: string): Promise<Response> {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Anthropic API key not configured')

    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    })
  }

  private static async callGemini(prompt: string): Promise<Response> {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY
    if (!apiKey) throw new Error('Google API key not configured')

    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.3
        }
      })
    })
  }

  private static async callPerplexity(prompt: string): Promise<Response> {
    const apiKey = import.meta.env.VITE_PERPLEXITY_API_KEY
    if (!apiKey) throw new Error('Perplexity API key not configured')

    return fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3
      })
    })
  }

  private static async parseResponse(response: Response, providerName: string): Promise<string[]> {
    
    if (!response.ok) {
      console.error(`❌ HTTP error from ${providerName}:`, response.status, response.statusText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    let content: string

    switch (providerName) {
      case 'OpenAI GPT-5':
        // GPT-5 mini has a new response format with output array
        if (data.output && data.output.length > 1) {
          // Find the message output (type: "message")
          const messageOutput = data.output.find((output: any) => output.type === 'message')
          if (messageOutput && messageOutput.content && messageOutput.content.length > 0) {
            content = messageOutput.content[0]?.text || ''
          } else {
            content = ''
          }
        } else {
          // Fallback to old format if needed
          content = data.choices?.[0]?.message?.content || ''
        }
        console.log(`💬 OpenAI content extracted:`, content)
        break
      case 'Anthropic Claude':
        content = data.content[0]?.text || ''
        break
      case 'Google Gemini':
        content = data.candidates[0]?.content?.parts[0]?.text || ''
        break
      case 'Perplexity AI':
        content = data.choices[0]?.message?.content || ''
        break
      default:
        throw new Error(`Unknown provider: ${providerName}`)
    }

    const businesses = this.extractBusinessNames(content)
    
    return businesses
  }

  private static extractBusinessNames(content: string): string[] {
    const lines = content.split('\n')
    const businesses: string[] = []

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/m)
      if (match && match[1]) {
        const businessName = match[1].trim()
        businesses.push(businessName)
      } else if (line.trim()) {
        console.log(`  ✗ Skipped: "${line.trim()}" (doesn't match pattern)`)
      }
    }

    return businesses
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
        
        // Log whether business was found for debugging
        if (result.success) {
          if (result.foundBusinessRank) {
            console.log(`✅ Found "${businessName}" as "${result.foundBusinessName}" at rank ${result.foundBusinessRank}/${result.totalRequested}`)
          } else {
            console.log(`❌ Business "${businessName}" not found in ${result.totalRequested} results`)
          }
        } else {
          console.error(`❌ Request failed: ${result.error}`)
        }
        
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
