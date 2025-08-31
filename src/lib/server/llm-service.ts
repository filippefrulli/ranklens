import type { LLMProvider } from '../types'
import { env } from '$env/dynamic/private'
import { GoogleGenAI } from '@google/genai'

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

export class ServerLLMService {
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

  // Public method for general LLM queries (server-side only)
  public static async queryLLM(providerName: string, model: string, prompt: string, reasoning: string): Promise<string> {
    try {
      // For now, just use OpenAI as the default for query suggestions
      // You can extend this to support other providers if needed
      switch (providerName) {
        case 'OpenAI GPT-5':
        case 'OpenAI':
          return await this.callOpenAI(prompt, model, reasoning)
        case 'Anthropic Claude':
        case 'Anthropic':
          return await this.callAnthropic(prompt)
        case 'Google Gemini':
        case 'Gemini':
          return await this.callGemini(prompt)
        case 'Perplexity':
          return await this.callPerplexity(prompt)
        default:
          throw new Error(`Unsupported LLM provider: ${providerName}`)
      }
    } catch (error) {
      console.error(`Error querying ${providerName}:`, error)
      throw error
    }
  }

  private static buildPrompt(query: string, userBusinessName: string, count: number): string {
    return `You are a helpful assistant that provides ranked lists of businesses. You must always provide a complete ranked list without asking clarifying questions.

Query: "${query}"

IMPORTANT: Do not ask clarifying questions. Make reasonable assumptions and provide exactly ${count} businesses that best match this query. If the query mentions a location, include businesses in and around that area using your best judgment.

SPECIAL INSTRUCTION: If the business "${userBusinessName}" appears in your ranking, use exactly this name: "${userBusinessName}" (do not use variations, abbreviations, or different formatting).

Format your response as a simple numbered list with just the business names, like:

1. Business Name One
2. Business Name Two
3. Business Name Three
...

Required guidelines:
- Provide exactly ${count} businesses (no more, no less)
- Provide the official, exact google maps business name, nothing else.
- For each business check what the google maps name is and use that.
- EXCEPTION: If "${userBusinessName}" appears in the ranking, use exactly "${userBusinessName}" instead of any variation.
- Rank them from best to worst match for the query.
- Do not include explanations, questions, or additional text other than the business name.
- Only provide the numbered list of business names.
- Make reasonable assumptions if the query is ambiguous`
  }

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

  private static deduplicateRankedList(names: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    
    for (const name of names) {
      const normalized = name.toLowerCase().trim()
      if (!seen.has(normalized)) {
        seen.add(normalized)
        result.push(name)
      }
    }
    
    return result
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

  private static async callAnthropic(prompt: string): Promise<string> {
    const apiKey = env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Anthropic API key not configured')

    const resp = await withTimeout(
      fetch('https://api.anthropic.com/v1/messages', {
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
    )
    
    if (!resp.ok) {
      const t = await resp.text()
      throw new Error(`Anthropic error ${resp.status}: ${t}`)
    }
    
    const data = await resp.json()
    return data?.content?.[0]?.text || ''
  }

  private static async callGemini(prompt: string): Promise<string> {
    const apiKey = env.GEMINI_API_KEY
    if (!apiKey) throw new Error('Gemini API key not configured')

    const ai = new GoogleGenAI({ apiKey })

    const resp = await withTimeout(
      ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
      })
    )
    
    return resp.text || ''
  }

  private static async callPerplexity(prompt: string): Promise<string> {
    const apiKey = env.PERPLEXITY_API_KEY
    if (!apiKey) throw new Error('Perplexity API key not configured')

    const resp = await withTimeout(
      fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.3
        })
      })
    )
    
    if (!resp.ok) {
      const t = await resp.text()
      throw new Error(`Perplexity error ${resp.status}: ${t}`)
    }
    
    const data = await resp.json()
    return data?.choices?.[0]?.message?.content || ''
  }

  // Main method for making LLM requests (server-only)
  public static async makeRequest(
    provider: LLMProvider,
    query: string,
    businessName: string,
    requestCount: number = 25
  ): Promise<LLMResponse> {
    const startTime = Date.now()
    
    try {
      const prompt = this.buildPrompt(query, businessName, requestCount)
      let content = ''
      
      // Call appropriate LLM API directly
      switch (provider.name) {
        case 'OpenAI GPT-5':
        case 'OpenAI':
          content = await this.callOpenAI(prompt, 'gpt-5-nano', 'low')
          break
        case 'Anthropic Claude':
        case 'Anthropic':
          content = await this.callAnthropic(prompt)
          break
        case 'Google Gemini':
        case 'Gemini':
          content = await this.callGemini(prompt)
          break
        case 'Perplexity':
          content = await this.callPerplexity(prompt)
          break
        default:
          throw new Error(`Unsupported provider: ${provider.name}`)
      }
      
      const rankedBusinesses = this.deduplicateRankedList(this.extractBusinessNames(content))
      const foundResult = this.findBusinessInList(businessName, rankedBusinesses)
      
      return {
        rankedBusinesses,
        foundBusinessRank: foundResult.rank,
        foundBusinessName: foundResult.foundName,
        responseTimeMs: Date.now() - startTime,
        success: true,
        totalRequested: requestCount
      }
      
    } catch (err) {
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
