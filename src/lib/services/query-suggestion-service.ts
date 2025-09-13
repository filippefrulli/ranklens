import type { Business } from '../types'
import { LLMService } from './llm-service'

interface QuerySuggestion {
  text: string
}

export class QuerySuggestionService {
  static async generateQuerySuggestions(business: Business): Promise<QuerySuggestion[]> {
    const prompt = this.buildPrompt(business)
    
    try {
      const content = await LLMService.queryLLM('Google Gemini', 'gemini-2.5-flash-lite', prompt, 'high')

      if (!content) {
        throw new Error('No content received from LLM')
      }

      return this.parseQuerySuggestions(content)
    } catch (error) {
      console.error('Error generating query suggestions:', error)
      throw new Error('Failed to generate query suggestions')
    }
  }

  private static buildPrompt(business: Business): string {
    return `Generate 5 natural, conversational queries that potential customers would ask an AI assistant when looking for the business called "${business.name}" or similar services.

Business Details:
- Name: ${business.name}
- City: ${business.city || 'Not specified'}
- Business Type: ${business.google_primary_type_display || 'Not specified'}
- Google Types: ${business.google_types ? JSON.stringify(business.google_types) : 'Not specified'}

CRITICAL REQUIREMENTS - NATURAL LANGUAGE STYLE:
1. Write queries as if someone is talking to an AI assistant conversationally
2. Use first-person language ("I am looking for", "I need", "I want", "Can you recommend")
3. Include context and specific needs/preferences when relevant
4. Queries should be complete sentences, not keyword searches
5. Make them sound natural and human-like, as people would actually speak

QUERY STRUCTURE GUIDELINES:
6. Start with conversational phrases like:
   - "I am looking for..."
   - "I need help finding..."
   - "Can you recommend..."
   - "I want to find..."
   - "What are the best options for..."
   - "I'm searching for..."

7. Include specific context when relevant:
   - Occasion: "for a date night", "for a business meeting", "for my family"
   - Group size: "for a couple", "for a group of friends", "for my team"
   - Specific needs: "with outdoor seating", "that delivers", "open late"
   - Purpose: "for a special celebration", "for lunch", "for weekend brunch"

8. Use natural location references:
   - "in Dublin city center"
   - "near Temple Bar"
   - "in the Dublin area"
   - "around Grafton Street"
   - "in Dublin 8" or "the Liberties"

9. Vary the query styles across the 5 suggestions:
   - Mix different starting phrases
   - Include different contexts/occasions
   - Vary specificity levels
   - Some with specific needs, some more general

10. Ensure queries would generate ranked lists when asked to AI
11. Focus on services/experiences that match the business type
12. Make them sound like real customer requests

Examples for different business types:

For a tour company:
- "I am looking for a fun Dublin city tour for a couple visiting for the weekend"
- "Can you recommend the best guided walking tours in Dublin city center?"
- "I need help finding an interesting historical tour of Dublin for my family"

For a restaurant:
- "I want to find a great Italian restaurant in Temple Bar for a date night"
- "What are the best pizza places near Grafton Street that deliver?"
- "I'm looking for a cozy restaurant in Dublin 8 for a business lunch"

For a coffee shop:
- "I need a good coffee shop in Dublin city center with wifi for working"
- "Can you recommend the best cafes around Trinity College for studying?"
- "I'm searching for a great brunch spot in the Liberties area"

Format your response as JSON with this structure:
{
  "suggestions": [
    "conversational query text 1",
    "conversational query text 2", 
    "conversational query text 3",
    "conversational query text 4",
    "conversational query text 5"
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

      const results = parsed.suggestions.map((suggestion: any) => ({
        text: typeof suggestion === 'string' ? suggestion : suggestion.text || ''
      })).filter((s: QuerySuggestion) => s.text.trim().length > 0)
      
      return results
      
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
            text: match[1]
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
