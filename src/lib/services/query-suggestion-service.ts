import type { Business } from '../types'

interface QuerySuggestion {
  text: string
  reasoning: string
}

export class QuerySuggestionService {
  static async generateQuerySuggestions(business: Business): Promise<QuerySuggestion[]> {
    const prompt = this.buildPrompt(business)
    
    try {
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'OpenAI GPT-5',
          model: 'gpt-5-nano',
          prompt
        })
      })

      if (!response.ok) {
        throw new Error(`Query suggestions API error: ${response.status} ${response.statusText}`)
      }

      const { content } = await response.json()

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

LOCATION STRATEGY - CRITICAL:
8. Use NATURAL, SEARCHABLE location terms that real customers use:
   - For local businesses (cafes, restaurants, shops): Use neighborhood names, districts, or well-known areas
   - For larger cities: Use neighborhoods like "Temple Bar", "Grafton Street", "Dublin city center", "Southside Dublin"
   - NEVER use postal codes (D08, D02) or technical city codes - use natural names
   - Examples: "Dublin 8" or "the Liberties" instead of "D08", "city center" instead of "CBD"
   - For service businesses: Can use broader city names if they serve the whole city

9. Match location granularity to business type:
   - Coffee shops, restaurants, retail: Use specific neighborhoods or districts
   - Professional services, hotels: Can use broader city areas
   - Consider realistic catchment area - a local cafe competes locally, not city-wide

10. Vary query length and specificity across the 5 suggestions

Examples of PERFECT location usage:
- "best coffee shops Dublin city center" (natural area name)
- "top brunch spots Temple Bar Dublin" (specific neighborhood)
- "most recommended cafes Grafton Street area" (well-known street/area)
- "highest rated restaurants Dublin 8" (natural postal district name)

Examples of BAD location usage:
- "best cafes D08" (postal code - users don't search this way)
- "top restaurants CBD Dublin" (technical term)
- "best coffee Dublin" (too broad for a local business)

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
      "text": "best pizza delivery Temple Bar",
      "reasoning": "Uses 'best' superlative with natural neighborhood name for local ranking"
    },
    {
      "text": "top Italian restaurants Dublin city center",
      "reasoning": "Uses 'top' ranking language for natural city area search"
    },
    {
      "text": "most recommended pizza places Dublin 2",
      "reasoning": "Uses 'most recommended' superlative with natural postal area reference"
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
