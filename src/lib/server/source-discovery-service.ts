import type { SourceInfo } from '../types'
import { ServerLLMService } from './llm-service'

export class SourceDiscoveryService {
  
  // Discover sources used for ranking businesses for a specific query
  public static async discoverQuerySources(query: string): Promise<SourceInfo[]> {
    console.log(`🔍 Discovering sources for query: "${query}"`)
    
    try {
      const prompt = `Analyze what sources and platforms you would use to rank businesses for this query: "${query}"

IMPORTANT: List the specific websites, platforms, and data sources you would reference to create an accurate business ranking. Include review sites, directories, social media platforms, and other relevant sources.

Format your response as a JSON array with this structure:
[
  {
    "platform": "Platform Name",
    "url": "https://example.com",
    "description": "Brief description of how this source helps with rankings",
    "importance": "high|medium|low",
    "category": "Review Platform|Business Directory|Social Media|Local Listings|Other"
  }
]

Requirements:
- Focus on sources that actually influence business rankings
- Rank sources by importance (high/medium/low) based on their reliability and coverage
- Include both general platforms (Google, Yelp) and niche ones relevant to the query
- Provide realistic URLs (use actual platform domains)
- Limit to 8-12 most important sources
- Prioritize sources with user reviews, ratings, and business information

Example categories:
- Review Platform: TripAdvisor, Yelp, Google Reviews
- Business Directory: Google Business Profile, Yellow Pages
- Social Media: Facebook, Instagram, Twitter
- Local Listings: City websites, tourism boards
- Other: Industry-specific platforms, news sites`

      const content = await ServerLLMService.queryLLM('Perplexity', 'sonar-pro', prompt, 'medium')
      
      const sources = this.parseSourceResponse(content)
      console.log(`✅ Query source discovery completed: Found ${sources.length} sources for "${query}"`)
      
      return sources
    } catch (error) {
      console.error(`❌ Error discovering query sources for "${query}":`, error instanceof Error ? error.message : error)
      return [] // Return empty array instead of throwing to prevent breaking analysis
    }
  }

    // Discover sources that mention or contain information about a specific business
  public static async discoverBusinessSources(businessName: string, location?: string): Promise<SourceInfo[]> {
    console.log(`🏢 Discovering business sources for: "${businessName}"${location ? ` in ${location}` : ''}`)
    
    try {
      const locationText = location ? ` in ${location}` : ''
      const prompt = `Find and list the specific websites and platforms where "${businessName}"${locationText} is mentioned, reviewed, or listed.

IMPORTANT: Provide actual sources where this business appears online, not theoretical sources. Include review platforms, business directories, social media, and any other relevant online presence.

Format your response as a JSON array with this structure:
[
  {
    "platform": "Platform Name",
    "url": "https://specific-url-or-platform.com",
    "description": "Description of the business presence on this platform",
    "importance": "high|medium|low",
    "category": "Review Platform|Business Directory|Social Media|Local Listings|News|Other"
  }
]

Include sources like:
- Review platforms with business listings
- Business directories and local listings
- Social media platform presence
- Industry-specific platforms
- Local tourism/business websites
- News mentions or features`

      const content = await ServerLLMService.queryLLM('Perplexity', 'sonar-pro', prompt, 'medium')
      
      const sources = this.parseSourceResponse(content)
      console.log(`✅ Business source discovery completed: Found ${sources.length} sources for "${businessName}"`)
      
      return sources
    } catch (error) {
      console.error(`❌ Error discovering business sources for "${businessName}":`, error instanceof Error ? error.message : error)
      return [] // Return empty array instead of throwing to prevent breaking analysis
    }
  }

  // Parse the JSON response from Perplexity and validate the structure
  private static parseSourceResponse(content: string): SourceInfo[] {
    try {
      // Clean the content to handle potential markdown formatting and extract JSON
      let cleanContent = content.trim()
      
      // Remove markdown code blocks
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      // Find the JSON array using bracket counting for proper matching
      const startIndex = cleanContent.indexOf('[')
      if (startIndex !== -1) {
        let bracketCount = 0
        let endIndex = startIndex
        
        for (let i = startIndex; i < cleanContent.length; i++) {
          if (cleanContent[i] === '[') {
            bracketCount++
          } else if (cleanContent[i] === ']') {
            bracketCount--
            if (bracketCount === 0) {
              endIndex = i
              break
            }
          }
        }
        
        if (bracketCount === 0) {
          cleanContent = cleanContent.substring(startIndex, endIndex + 1)
        }
      } else {
        // If no array found, try to find JSON object and wrap in array
        const objectMatch = cleanContent.match(/\{[\s\S]*?\}/)
        if (objectMatch) {
          cleanContent = `[${objectMatch[0]}]`
        }
      }
      
      const parsed = JSON.parse(cleanContent)
      
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array')
      }

      // Validate and clean the source info
      const sources: SourceInfo[] = parsed
        .filter(item => item && typeof item === 'object')
        .map(item => ({
          platform: item.platform || 'Unknown Platform',
          url: item.url || 'https://example.com',
          description: item.description || 'No description available',
          importance: ['high', 'medium', 'low'].includes(item.importance) ? item.importance : 'medium',
          category: item.category || 'Other'
        }))
        .filter(source => source.platform !== 'Unknown Platform')
        .slice(0, 12) // Limit to 12 sources max

      return sources
      
    } catch (error) {
      console.error('Error parsing source response:', error)
      
      // Log a truncated version of the content for debugging (first 500 chars)
      const truncatedContent = content.length > 500 ? content.substring(0, 500) + '...' : content
      console.error('Content preview:', truncatedContent)
      
      // Try to extract any valid JSON from the content as a last resort
      try {
        const jsonMatches = content.match(/\{[^}]*"platform"[^}]*\}/g)
        if (jsonMatches && jsonMatches.length > 0) {
          console.log('Attempting to recover partial sources from content...')
          const partialSources = jsonMatches
            .map(match => {
              try {
                return JSON.parse(match)
              } catch {
                return null
              }
            })
            .filter(Boolean)
            .slice(0, 5) // Limit recovered sources
          
          if (partialSources.length > 0) {
            console.log(`✅ Recovered ${partialSources.length} sources from partial JSON`)
            return partialSources.map(item => ({
              platform: item.platform || 'Unknown Platform',
              url: item.url || 'https://example.com',
              description: item.description || 'No description available',
              importance: ['high', 'medium', 'low'].includes(item.importance) ? item.importance : 'medium',
              category: item.category || 'Other'
            }))
          }
        }
      } catch (recoveryError) {
        console.error('Failed to recover partial sources:', recoveryError)
      }
      
      // Final fallback to empty array if all parsing fails
      console.warn('⚠️ Source discovery parsing completely failed, returning empty results')
      return []
    }
  }

  // Analyze blind spots by comparing query sources vs business sources
  public static analyzeBlindSpots(querySources: SourceInfo[], businessSources: SourceInfo[]): {
    missing_platforms: SourceInfo[]
    underutilized_platforms: SourceInfo[]
    opportunities: SourceInfo[]
  } {
    const queryPlatforms = new Set(querySources.map(s => s.platform.toLowerCase()))
    const businessPlatforms = new Set(businessSources.map(s => s.platform.toLowerCase()))

    // Platforms mentioned in query sources but not in business sources
    const missing_platforms = querySources.filter(
      source => !businessPlatforms.has(source.platform.toLowerCase())
    )

    // Platforms where business is present but not commonly used for ranking this type of query
    const underutilized_platforms = businessSources.filter(
      source => !queryPlatforms.has(source.platform.toLowerCase())
    )

    // High-importance missing platforms are key opportunities
    const opportunities = missing_platforms.filter(
      source => source.importance === 'high'
    )

    return {
      missing_platforms,
      underutilized_platforms,
      opportunities
    }
  }
}
