// Centralized LLM provider & model constants (Approach A - minimal)

export enum LLMProviderId {
  OPENAI = 'openai',
  GEMINI = 'gemini'
}

export interface LLMProviderConfig {
  id: LLMProviderId
  displayName: string
  defaultModel: string
  allowedModels: string[]
}

export const LLM_PROVIDER_CONFIG: Record<LLMProviderId, LLMProviderConfig> = {
  [LLMProviderId.OPENAI]: {
    id: LLMProviderId.OPENAI,
    displayName: 'OpenAI',
    defaultModel: 'gpt-5-nano',
    allowedModels: ['gpt-5-nano', 'gpt-5-mini']
  },
  [LLMProviderId.GEMINI]: {
    id: LLMProviderId.GEMINI,
    displayName: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash-lite',
    allowedModels: ['gemini-2.5-flash-lite']
  }
}

// Convenience exported defaults (avoid scattering literals)
export const DEFAULT_MODELS = {
  OPENAI: LLM_PROVIDER_CONFIG[LLMProviderId.OPENAI].defaultModel,
  GEMINI: LLM_PROVIDER_CONFIG[LLMProviderId.GEMINI].defaultModel
} as const

export function getDefaultModel(id: LLMProviderId): string {
  return LLM_PROVIDER_CONFIG[id].defaultModel
}

// Display name helpers (single source of truth)
export const PROVIDER_DISPLAY_NAMES: Record<LLMProviderId, string> = {
  [LLMProviderId.OPENAI]: LLM_PROVIDER_CONFIG[LLMProviderId.OPENAI].displayName,
  [LLMProviderId.GEMINI]: LLM_PROVIDER_CONFIG[LLMProviderId.GEMINI].displayName,
}

export function getProviderDisplayName(rawOrId: string): string {
  try {
    const { id } = normalizeProvider(rawOrId)
    return PROVIDER_DISPLAY_NAMES[id]
  } catch {
    // Fallback to original (should be avoided; indicates missing alias/config)
    return rawOrId
  }
}

// Alias map for provider name normalization (all lowercase keys)
const PROVIDER_ALIASES: Record<string, { id: LLMProviderId; modelOverride?: string }> = {
  // OpenAI variants
  'openai': { id: LLMProviderId.OPENAI },
  'open ai': { id: LLMProviderId.OPENAI },
  'gpt-5': { id: LLMProviderId.OPENAI },
  'gpt5': { id: LLMProviderId.OPENAI },
  'openai gpt-5': { id: LLMProviderId.OPENAI },
  'openai gpt5': { id: LLMProviderId.OPENAI },
  'openai gpt-5 nano': { id: LLMProviderId.OPENAI, modelOverride: 'gpt-5-nano' },
  'openai gpt-5-nano': { id: LLMProviderId.OPENAI, modelOverride: 'gpt-5-nano' },
  'openai gpt-4.1-mini': { id: LLMProviderId.OPENAI, modelOverride: 'gpt-4.1-mini' },
  // Gemini variants
  'gemini': { id: LLMProviderId.GEMINI },
  'google gemini': { id: LLMProviderId.GEMINI },
  'google': { id: LLMProviderId.GEMINI },
  'gemini 2.5': { id: LLMProviderId.GEMINI },
}

export interface NormalizedProviderResult {
  id: LLMProviderId
  model: string
  displayName: string
  original: string
}

export function normalizeProvider(rawName: string, requestedModel?: string): NormalizedProviderResult {
  const key = rawName.toLowerCase().trim()
  const alias = PROVIDER_ALIASES[key]
  if (!alias) {
    // Fallback: attempt loose contains matching
    for (const candidate in PROVIDER_ALIASES) {
      if (key.includes(candidate)) {
        const found = PROVIDER_ALIASES[candidate]
        return finalize(found.id, rawName, requestedModel, found.modelOverride)
      }
    }
    throw new Error(`Unknown LLM provider alias: "${rawName}"`)
  }
  return finalize(alias.id, rawName, requestedModel, alias.modelOverride)
}

function finalize(id: LLMProviderId, original: string, requestedModel?: string, overrideModel?: string): NormalizedProviderResult {
  const cfg = LLM_PROVIDER_CONFIG[id]
  let model = overrideModel || requestedModel || cfg.defaultModel
  if (!cfg.allowedModels.includes(model)) {
    console.warn(`[llm] Model '${model}' not allowed for provider '${cfg.displayName}', falling back to default '${cfg.defaultModel}'`)
    model = cfg.defaultModel
  }
  return { id, model, displayName: cfg.displayName, original }
}
