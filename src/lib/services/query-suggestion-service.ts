import type { Business } from '../types'

interface QuerySuggestion {
  text: string
  reasoning: string
}

export class QuerySuggestionService {
  private static readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
  
  static async generateQuerySuggestions(business: Business): Promise<QuerySuggestion[]> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const prompt = this.buildPrompt(business)
    
    try {
      const response = await fetch(this.OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert SEO and local search specialist. Generate realistic search queries that customers would use to find specific types of businesses. Focus on queries where the business has a realistic chance of ranking in the top 25 results.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('No content received from OpenAI')
      }

      return this.parseQuerySuggestions(content)
    } catch (error) {
      console.error('Error generating query suggestions:', error)
      throw new Error('Failed to generate query suggestions')
    }
  }

  private static buildPrompt(business: Business): string {
    return `Generate 5 realistic search queries that potential customers would use to find a business like "${business.name}".

Business Details:
- Name: ${business.name}
- City: ${business.city || 'Not specified'}
- Business Type: ${business.google_primary_type_display || 'Not specified'}
- Google Types: ${business.google_types ? JSON.stringify(business.google_types) : 'Not specified'}

CRITICAL REQUIREMENTS:
1. Queries MUST result in RANKED LISTS of businesses/services when asked to AI
2. Use ONLY ranking phrases: "best", "top", "most recommended", "highest rated"
3. Avoid numbered lists ("top 10", "top 5") - use open-ended ranking terms
4. Avoid informational queries ("where to find", "how to", "what is", "where can I")
5. Avoid review-focused queries ("reviews", "ratings", "feedback")
6. Avoid comparison queries ("compare", "vs", "versus", "difference between")
7. Focus on superlative and ranking language that demands ordered lists
8. Include location-based queries (using the city if provided)
9. Consider market size - some niches may only have a few businesses
10. Vary query length and specificity

Examples of PERFECT ranking queries:
- "best pizza restaurants in Dublin"
- "top coffee shops Dublin city center"
- "most recommended sushi places downtown"
- "highest rated Italian restaurants Dublin"
- "best brunch spots Dublin weekends"

Examples of BAD queries that don't produce rankings:
- "top 10 pizza places Dublin" (numbered constraint)
- "where to find pizza in Dublin" (informational)
- "reviews of Pizza Palace" (review-focused)
- "compare Italian restaurants" (comparison)
- "how to choose a restaurant" (how-to)

Format your response as JSON with this structure:
{
  "suggestions": [
    {
      "text": "search query text",
      "reasoning": "brief explanation why this query will produce a ranked list"
    }
  ]
}

Example for a pizza restaurant in Dublin:
{
  "suggestions": [
    {
      "text": "best pizza delivery Dublin",
      "reasoning": "Uses 'best' superlative to request open-ended ranked list of pizza delivery options"
    },
    {
      "text": "top Italian restaurants Dublin city center",
      "reasoning": "Uses 'top' ranking language for location-specific ordered recommendations"
    },
    {
      "text": "most recommended pizza places Dublin",
      "reasoning": "Uses 'most recommended' superlative that demands ranked results without number limits"
    }
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

      return parsed.suggestions.map((suggestion: any) => ({
        text: suggestion.text || '',
        reasoning: suggestion.reasoning || ''
      })).filter((s: QuerySuggestion) => s.text.trim().length > 0)
      
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
            text: match[1],
            reasoning: 'Generated query suggestion'
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
