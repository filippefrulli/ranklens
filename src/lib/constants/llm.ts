// LLM provider & model constants — single source of truth

export enum LLMProviderId {
  OPENAI = 'openai',
  GEMINI = 'gemini'
}

export interface LLMModel {
  provider: LLMProviderId
  model: string        // API model identifier
  displayName: string  // shown in UI
}

export const LLM_MODELS: LLMModel[] = [
  { provider: LLMProviderId.OPENAI, model: 'gpt-5-nano',            displayName: 'GPT-5 Nano' },
  { provider: LLMProviderId.OPENAI, model: 'gpt-5-mini',            displayName: 'GPT-5 Mini' },
  { provider: LLMProviderId.GEMINI, model: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash' },
  { provider: LLMProviderId.GEMINI, model: 'gemini-3-pro-preview',   displayName: 'Gemini 3 Pro' },
]

// Default model per provider
export const DEFAULT_MODELS: Record<LLMProviderId, string> = {
  [LLMProviderId.OPENAI]: 'gpt-5-nano',
  [LLMProviderId.GEMINI]: 'gemini-3-flash-preview',
}

// Display names per provider (for landing pages, etc.)
export const PROVIDER_DISPLAY_NAMES: Record<LLMProviderId, string> = {
  [LLMProviderId.OPENAI]: 'OpenAI',
  [LLMProviderId.GEMINI]: 'Google Gemini',
}

/**
 * Resolve a raw provider string (e.g. DB name like "google-gemini-3-flash")
 * to a canonical provider id. Simple contains-check.
 */
export function resolveProviderId(raw: string): LLMProviderId {
  const lower = raw.toLowerCase()
  if (lower.includes('openai') || lower.includes('gpt')) return LLMProviderId.OPENAI
  if (lower.includes('gemini') || lower.includes('google')) return LLMProviderId.GEMINI
  throw new Error(`Unknown LLM provider: "${raw}"`)
}
