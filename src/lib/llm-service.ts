import type { LLMProvider } from './types'

export interface LLMResponse {
  rankedBusinesses: string[]
  responseTimeMs: number
  success: boolean
  error?: string
}

export class LLMService {
  private static async makeRequest(
    provider: LLMProvider,
    query: string,
    businessName: string
  ): Promise<LLMResponse> {
    const startTime = Date.now()
    
    try {
      const prompt = this.buildPrompt(query, businessName)
      let response: Response
      
      switch (provider.name) {
        case 'OpenAI GPT-4':
          response = await this.callOpenAI(prompt)
          break
        case 'Anthropic Claude':
          response = await this.callAnthropic(prompt)
          break
        case 'Google Gemini':
          response = await this.callGemini(prompt)
          break
        case 'Cohere Command':
          response = await this.callCohere(prompt)
          break
        case 'Perplexity AI':
          response = await this.callPerplexity(prompt)
          break
        default:
          throw new Error(`Unsupported LLM provider: ${provider.name}`)
      }

      const responseTimeMs = Date.now() - startTime
      const rankedBusinesses = await this.parseResponse(response, provider.name)
      
      return {
        rankedBusinesses,
        responseTimeMs,
        success: true
      }
    } catch (error) {
      return {
        rankedBusinesses: [],
        responseTimeMs: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private static buildPrompt(query: string, businessName: string): string {
    return `Please provide a ranked list of businesses that match the following query: "${query}"

Requirements:
- Return ONLY a numbered list of business names
- Include ${businessName} in the list if it's relevant
- Limit to top 10 results
- Format: "1. Business Name"
- No additional commentary or explanation

Query: ${query}`
  }

  private static async callOpenAI(prompt: string): Promise<Response> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) throw new Error('OpenAI API key not configured')

    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3
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

  private static async callCohere(prompt: string): Promise<Response> {
    const apiKey = import.meta.env.VITE_COHERE_API_KEY
    if (!apiKey) throw new Error('Cohere API key not configured')

    return fetch('https://api.cohere.ai/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'command',
        prompt,
        max_tokens: 500,
        temperature: 0.3
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
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    let content: string

    switch (providerName) {
      case 'OpenAI GPT-4':
        content = data.choices[0]?.message?.content || ''
        break
      case 'Anthropic Claude':
        content = data.content[0]?.text || ''
        break
      case 'Google Gemini':
        content = data.candidates[0]?.content?.parts[0]?.text || ''
        break
      case 'Cohere Command':
        content = data.generations[0]?.text || ''
        break
      case 'Perplexity AI':
        content = data.choices[0]?.message?.content || ''
        break
      default:
        throw new Error(`Unknown provider: ${providerName}`)
    }

    return this.extractBusinessNames(content)
  }

  private static extractBusinessNames(content: string): string[] {
    const lines = content.split('\n')
    const businesses: string[] = []

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/m)
      if (match && match[1]) {
        businesses.push(match[1].trim())
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
      if (!provider.is_active) continue

      const providerResults: LLMResponse[] = []
      
      for (let i = 0; i < attempts; i++) {
        const result = await this.makeRequest(provider, query, businessName)
        providerResults.push(result)
        
        // Add small delay between requests to be respectful to APIs
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      results.set(provider.name, providerResults)
    }

    return results
  }
}
