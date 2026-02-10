import type { Company } from '../types'
import { LLMService } from './llm-service'
import { LLMProviderId, DEFAULT_MODELS } from '$lib/constants/llm'
import { buildCompanyResearchPrompt, buildQuerySuggestionsPrompt } from './prompt-templates'

interface QuerySuggestion {
  text: string
}

type CompanyResearchNarrative = string

export class QuerySuggestionService {
  private static readonly MAX_RETRIES = 3
  private static readonly TIMEOUT_MS = 150000

  static async generateQuerySuggestions(company: Company): Promise<QuerySuggestion[]> {
    try {
      const researchNarrative = await this.researchCompanyWithRetry(company)
      const prompt = this.buildPrompt(company, researchNarrative)
      const content = await this.queryLLMWithRetry(LLMProviderId.OPENAI, DEFAULT_MODELS.OPENAI, prompt, 'low')

      if (!content) {
        throw new Error('No content received from LLM')
      }

      return this.parseQuerySuggestions(content)
    } catch (error) {
      console.error('[Service] QuerySuggestion: Error generating suggestions', error)
      throw new Error('Failed to generate query suggestions')
    }
  }

  private static async queryLLMWithRetry(
    provider: string,
    model: string,
    prompt: string,
    reasoning: string,
    attempt: number = 1
  ): Promise<string> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.TIMEOUT_MS)
      })
      const llmPromise = LLMService.queryLLM(provider, model, prompt, reasoning)
      const content = await Promise.race([llmPromise, timeoutPromise])
      if (!content) throw new Error('No content received from LLM')
      return content
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.queryLLMWithRetry(provider, model, prompt, reasoning, attempt + 1)
      }
      throw new Error(`LLM query failed after ${this.MAX_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private static async researchCompanyWithRetry(company: Company, attempt: number = 1): Promise<CompanyResearchNarrative> {
    try {
      return await this.researchCompany(company)
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.researchCompanyWithRetry(company, attempt + 1)
      }
      return this.createFallbackResearch(company)
    }
  }

  private static async researchCompany(company: Company): Promise<CompanyResearchNarrative> {
    const researchPrompt = buildCompanyResearchPrompt({
      name: company.name,
      googlePrimaryTypeDisplay: company.google_primary_type_display
    })

    const researchContent = await this.queryLLMWithRetry(LLMProviderId.OPENAI, DEFAULT_MODELS.OPENAI, researchPrompt, 'medium')

    if (!researchContent) {
      throw new Error('No research content received')
    }

    return researchContent.trim()
  }

  private static createFallbackResearch(company: Company): CompanyResearchNarrative {
    const type = (company.google_primary_type_display || 'company').toLowerCase()
    return `${company.name} is a ${type} likely operating at a mid-range price point and serving general customers. Its positioning cannot be fully inferred due to limited data.`
      + ` It probably focuses on delivering consistent core value with standard features while aiming to attract repeat interest.`
  }

  private static buildPrompt(company: Company, researchNarrative: CompanyResearchNarrative): string {
    return buildQuerySuggestionsPrompt({
      companyName: company.name,
      researchNarrative,
      mainCity: '' // City removed from company in v2 schema
    })
  }

  private static parseQuerySuggestions(content: string): QuerySuggestion[] {
    const cleaned = content.replace(/```json\n?/gi, '').replace(/```/g, '').trim()
    try {
      const parsed = JSON.parse(cleaned)
      if (parsed && Array.isArray(parsed.suggestions)) {
        const arr = parsed.suggestions
          .map((s: any) => (typeof s === 'string' ? s : s?.text || ''))
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
          .slice(0, 6)
        if (arr.length > 0) return arr.map((text: string) => ({ text }))
      }
    } catch {
      // fall through to line-based parsing
    }

    const lines = cleaned.split(/\r?\n/)
      .map(l => l.trim().replace(/^[-*\d+.\)]\s*/, ''))
      .filter(l => l.length > 0 && !l.startsWith('{') && !l.startsWith('"suggestions"'))

    const queries = lines.slice(0, 6).map(text => ({ text }))
    if (queries.length === 0) {
      throw new Error('Failed to parse query suggestions (no JSON or lines)')
    }
    return queries
  }
}
