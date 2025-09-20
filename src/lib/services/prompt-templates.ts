// Centralized LLM prompt templates & builders
// Keep pure, side-effect free. All logging stays in service layer.

export interface RankingPromptParams {
  query: string
  userBusinessName: string
  count: number
}

export function buildRankingPrompt({ query, userBusinessName, count }: RankingPromptParams): string {
  return `You are a helpful assistant that provides ranked lists of businesses. You must always provide a complete ranked list without asking clarifying questions.

Query: "${query}"

IMPORTANT: Do not ask clarifying questions. Make reasonable assumptions and provide exactly ${count} businesses that best match this query. If the query mentions a location, include businesses in and around that area using your best judgment.

Format your response as a simple numbered list with just the business names, like:

1. Business Name One
2. Business Name Two
3. Business Name Three
...

Required guidelines:
- Provide exactly ${count} businesses (no more, no less)
- Provide business names as they are listed on google maps, and no other way.
- Rank them from best to worst match for the query
- Do not include explanations, questions, or additional text other than the business name
- Only provide the numbered list of business names
- Make reasonable assumptions if the query is ambiguous`}

export interface StandardizationPromptParams {
  businessNames: string[]
  userBusinessName: string
}

export function buildStandardizationPrompt({ businessNames, userBusinessName }: StandardizationPromptParams): string {
  return `You are a business name standardization assistant. Your task is to convert business names to their official Google Maps names and eliminate duplicates.

IMPORTANT INSTRUCTIONS:
1. For each business name provided, return the exact official Google Maps business name
2. If a business name matches or is very similar to "${userBusinessName}", return exactly "${userBusinessName}"
3. ELIMINATE DUPLICATES: If you see variations like "Wild Rover Tours" and "The Wild Rover Tours", or "Dublin Free Walking Tour" and "Dublin Free Walking Tours", only return ONE version - the most official Google Maps name
4. Prefer names WITHOUT "The" prefix unless that's the official name (e.g., prefer "Wild Rover Tours" over "The Wild Rover Tours")
5. Use singular forms unless plural is the official name (e.g., prefer "Dublin Free Walking Tour" over "Dublin Free Walking Tours")
6. Only return the standardized names, one per line, no numbering or extra text
7. If a business is not a real, Google Maps registered business, remove it from the list
8. If multiple variations refer to the same business, only include it once

Business names to standardize:
${businessNames.map((name, index) => `${index + 1}. ${name}`).join('\n')}

Return format: Just the unique standardized business names, one per line, with duplicates removed:`}

// ---------------- Additional Prompt Builders (Query Suggestions Flow) ----------------

export interface BusinessResearchPromptParams {
  name: string
  city?: string | null
  googlePrimaryTypeDisplay?: string | null
}

// Builds the TWO-paragraph business research prompt previously in query-suggestion-service
export function buildBusinessResearchPrompt({ name, city, googlePrimaryTypeDisplay }: BusinessResearchPromptParams): string {
  return `You are an analyst. Write exactly TWO concise paragraphs (no lists, no headings) describing the business "${name}".

Context:
Name: ${name}
Location: ${city || 'Not specified'}
Google Type (optional): ${googlePrimaryTypeDisplay || 'Unknown'}

Paragraph 1: Infer positioning, category, likely price tier, audience, and core qualities. Be specific but concise.
Paragraph 2: Infer distinctive amenities, differentiators, experience style, and what customers might value. Natural prose.

Rules:
- 2 paragraphs only.
- No JSON, no bullet points, no labels.
- <= 90 words each.
- Avoid repeating the business name more than once besides the opening.
`
}

export interface QuerySuggestionsPromptParams {
  businessName: string
  researchNarrative: string
  mainCity: string
}

// Builds the JSON-output query suggestions generation prompt
export function buildQuerySuggestionsPrompt({ businessName, researchNarrative, mainCity }: QuerySuggestionsPromptParams): string {
  return `You will generate customer search queries an AI assistant might receive when someone is seeking ${businessName} or similar services.

Business Research Narrative (context for grounding – do NOT summarize it back):
"""
${researchNarrative}
"""

Task:
Generate exactly 6 diverse natural-language query strings a user would type/say. Use the narrative to infer positioning, amenities, audience, price tier and vary across the set.

Requirements:
1. EACH query MUST contain some form of location reference ("${mainCity}" or a neighborhood, an area, or a major landmark)
2. EXACTLY 6 queries: 3 SHORT (6-10 words) + 3 DETAILED (12-18 words)
3. SINGLE intent per query (no plural mixed categories, no combining unrelated asks)
4. Vary structure, tone, and included inferred attributes (price tier, amenity, audience), avoid repeating the same adjective or location form more than twice
5. Do not mention the business name directly, always write queries to search for the type of business or its features
6. Avoid wrapping queries in quotes; they are plain strings
7. No numbering, no bullets, no explanation outside JSON
8. Return valid minified JSON ONLY with a top-level key "suggestions" mapping to an array of 6 strings.
9. Ensure the queries are written in natural, conversational language that a real user would use, starting sentences like 'I'm looking for...', 'Where can I find...', 'What are the best...', etc.

Output JSON schema:
{"suggestions": ["query1", "query2", "query3", "query4", "query5", "query6"]}`
}
