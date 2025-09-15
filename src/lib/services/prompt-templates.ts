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
