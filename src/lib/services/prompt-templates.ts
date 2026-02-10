// Centralized LLM prompt templates & builders
// Keep pure, side-effect free. All logging stays in service layer.

export interface RankingPromptParams {
  query: string
  userProductName: string
  count: number
}

export function buildRankingPrompt({ query, userProductName, count }: RankingPromptParams): string {
  return `You are a helpful assistant that provides ranked lists of products, services, or businesses. You must always provide a complete ranked list without asking clarifying questions.

Query: "${query}"

IMPORTANT: Do not ask clarifying questions. Make reasonable assumptions and provide exactly ${count} results that best match this query. If the query mentions a location, include results in and around that area using your best judgment.

Format your response as a simple numbered list with just the names, like:

1. Name One
2. Name Two
3. Name Three
...

Required guidelines:
- Provide exactly ${count} results (no more, no less)
- Provide names as they are commonly known or listed on google maps where applicable.
- Rank them from best to worst match for the query
- Do not include explanations, questions, or additional text other than the name
- Only provide the numbered list of names
- Make reasonable assumptions if the query is ambiguous`}

export interface StandardizationPromptParams {
  productNames: string[]
  userProductName: string
}

export function buildStandardizationPrompt({ productNames, userProductName }: StandardizationPromptParams): string {
  return `You are a name standardization assistant. Your task is to convert product/business names to their official or commonly recognized names and eliminate duplicates.

IMPORTANT INSTRUCTIONS:
1. For each name provided, return the exact official or most commonly recognized name
2. If a name matches or is very similar to "${userProductName}", return exactly "${userProductName}"
3. ELIMINATE DUPLICATES: If you see variations like "Wild Rover Tours" and "The Wild Rover Tours", or "Dublin Free Walking Tour" and "Dublin Free Walking Tours", only return ONE version - the most official name
4. Prefer names WITHOUT "The" prefix unless that's the official name
5. Use singular forms unless plural is the official name
6. Only return the standardized names, one per line, no numbering or extra text
7. If multiple variations refer to the same entity, only include it once

Names to standardize:
${productNames.map((name, index) => `${index + 1}. ${name}`).join('\n')}

Return format: Just the unique standardized names, one per line, with duplicates removed:`}

// ---------------- Additional Prompt Builders (Query Suggestions Flow) ----------------

export interface CompanyResearchPromptParams {
  name: string
  googlePrimaryTypeDisplay?: string | null
}

// Builds the TWO-paragraph company research prompt for query suggestion generation
export function buildCompanyResearchPrompt({ name, googlePrimaryTypeDisplay }: CompanyResearchPromptParams): string {
  return `You are an analyst. Write exactly TWO concise paragraphs (no lists, no headings) describing the company/brand "${name}".

Context:
Name: ${name}
Google Type (optional): ${googlePrimaryTypeDisplay || 'Unknown'}

Paragraph 1: Infer positioning, category, likely price tier, audience, and core qualities. Be specific but concise.
Paragraph 2: Infer distinctive amenities, differentiators, experience style, and what customers might value. Natural prose.

Rules:
- 2 paragraphs only.
- No JSON, no bullet points, no labels.
- <= 90 words each.
- Avoid repeating the company name more than once besides the opening.
`
}

export interface QuerySuggestionsPromptParams {
  companyName: string
  researchNarrative: string
  mainCity: string
}

// Builds the JSON-output query suggestions generation prompt
export function buildQuerySuggestionsPrompt({ companyName, researchNarrative, mainCity }: QuerySuggestionsPromptParams): string {
  return `You will generate customer search queries an AI assistant might receive when someone is seeking ${companyName} or similar products/services.

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
5. Do not mention the company name directly, always write queries to search for the type of product/service or its features
6. Avoid wrapping queries in quotes; they are plain strings
7. No numbering, no bullets, no explanation outside JSON
8. Return valid minified JSON ONLY with a top-level key "suggestions" mapping to an array of 6 strings.
9. Ensure the queries are written in natural, conversational language that a real user would use, starting sentences like 'I'm looking for...', 'Where can I find...', 'What are the best...', etc.

Output JSON schema:
{"suggestions": ["query1", "query2", "query3", "query4", "query5", "query6"]}`
}
