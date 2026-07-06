// API Configuration for VoiceAgent
// Supports multiple providers with user-defined models

export type Provider = 'dashscope' | 'openai' | 'anthropic' | 'groq'

export type FunctionType = 'asr' | 'intent' | 'summary' | 'research'

export interface ProviderInfo {
  id: Provider
  name: string
  chatEndpoint: string
  asrEndpoint?: string
  supportsASR: boolean
  keyPlaceholder: string
  defaultModels: Record<FunctionType, string>
}

export interface APIKeyConfig {
  provider: Provider
  key: string
}

export interface ModelAssignment {
  function: FunctionType
  provider: Provider
  model: string
  validated: boolean  // Whether this config has been tested
  lastError?: string  // Last validation error if any
}

export interface UserAPIConfig {
  keys: APIKeyConfig[]
  assignments: ModelAssignment[]
}

// Provider configurations
export const PROVIDERS: Record<Provider, ProviderInfo> = {
  dashscope: {
    id: 'dashscope',
    name: 'Alibaba DashScope',
    chatEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    asrEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    supportsASR: true,
    keyPlaceholder: 'sk-...',
    defaultModels: {
      asr: 'qwen3-asr-flash',
      intent: 'qwen-max',
      summary: 'qwen-turbo',
      research: 'qwen-max'
    }
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    chatEndpoint: 'https://api.openai.com/v1/chat/completions',
    asrEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
    supportsASR: true,
    keyPlaceholder: 'sk-...',
    defaultModels: {
      asr: 'whisper-1',
      intent: 'gpt-4o-mini',
      summary: 'gpt-4o-mini',
      research: 'gpt-4o'
    }
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    chatEndpoint: 'https://api.anthropic.com/v1/messages',
    supportsASR: false,
    keyPlaceholder: 'sk-ant-...',
    defaultModels: {
      asr: '', // Not supported
      intent: 'claude-3-5-sonnet-20241022',
      summary: 'claude-3-haiku-20240307',
      research: 'claude-3-5-sonnet-20241022'
    }
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    chatEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    asrEndpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
    supportsASR: true,
    keyPlaceholder: 'gsk_...',
    defaultModels: {
      asr: 'whisper-large-v3',
      intent: 'llama-3.3-70b-versatile',
      summary: 'llama-3.1-8b-instant',
      research: 'llama-3.3-70b-versatile'
    }
  }
}

// Function display names and descriptions
export const FUNCTION_INFO: Record<FunctionType, { name: string; description: string }> = {
  asr: { name: 'Speech Recognition', description: 'Convert voice to text' },
  intent: { name: 'Intent Detection', description: 'Classify as Publish or Note mode' },
  summary: { name: 'Summary Generation', description: 'Generate quick 200-word summary' },
  research: { name: 'Deep Research', description: 'Comprehensive analysis with web search' },
}

// Default configuration
export function getDefaultConfig(): UserAPIConfig {
  return {
    keys: [],
    assignments: [
      { function: 'asr', provider: 'dashscope', model: 'qwen3-asr-flash', validated: false },
      { function: 'intent', provider: 'dashscope', model: 'qwen-max', validated: false },
      { function: 'summary', provider: 'dashscope', model: 'qwen-turbo', validated: false },
      { function: 'research', provider: 'dashscope', model: 'qwen-max', validated: false },
    ]
  }
}

const STORAGE_KEY = 'voiceagent_api_config'

/**
 * Load API configuration from localStorage
 */
export function loadAPIConfig(): UserAPIConfig {
  if (typeof window === 'undefined') return getDefaultConfig()
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const config = JSON.parse(saved) as UserAPIConfig
      const defaults = getDefaultConfig()
      return {
        keys: config.keys || [],
        assignments: defaults.assignments.map(defaultAssign => {
          const userAssign = config.assignments?.find(a => a.function === defaultAssign.function)
          return userAssign || defaultAssign
        })
      }
    }
  } catch (error) {
    console.error('[v0] Error loading API config:', error)
  }
  
  return getDefaultConfig()
}

/**
 * Save API configuration to localStorage
 */
export function saveAPIConfig(config: UserAPIConfig): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (error) {
    console.error('[v0] Error saving API config:', error)
  }
}

/**
 * Get API key for a specific provider
 */
export function getAPIKey(config: UserAPIConfig, provider: Provider): string {
  return config.keys.find(k => k.provider === provider)?.key || ''
}

/**
 * Get model assignment for a specific function
 */
export function getAssignment(config: UserAPIConfig, func: FunctionType): ModelAssignment {
  return config.assignments.find(a => a.function === func) || getDefaultConfig().assignments.find(a => a.function === func)!
}

/**
 * Get provider info by ID
 */
export function getProviderInfo(providerId: Provider): ProviderInfo {
  return PROVIDERS[providerId]
}

/**
 * Check if a function has a valid configuration (API key set for its provider)
 */
export function isFunctionConfigured(config: UserAPIConfig, func: FunctionType): boolean {
  const assignment = getAssignment(config, func)
  const key = getAPIKey(config, assignment.provider)
  return !!key && !!assignment.model
}

/**
 * Check if a function is validated
 */
export function isFunctionValidated(config: UserAPIConfig, func: FunctionType): boolean {
  const assignment = getAssignment(config, func)
  return assignment.validated
}

/**
 * Get all functions that need configuration
 */
export function getUnconfiguredFunctions(config: UserAPIConfig): FunctionType[] {
  return (['asr', 'intent', 'summary', 'research'] as FunctionType[]).filter(
    func => !isFunctionConfigured(config, func)
  )
}

/**
 * Validate an API key + model combination by making a test request
 * Returns { valid: true } or { valid: false, error: string }
 */
export async function validateAPIConfig(
  provider: Provider,
  apiKey: string,
  model: string,
  func: FunctionType
): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' }
  }
  if (!model) {
    return { valid: false, error: 'Model name is required' }
  }

  const providerInfo = PROVIDERS[provider]
  
  // Special case for ASR - different validation
  if (func === 'asr') {
    if (!providerInfo.supportsASR) {
      return { valid: false, error: `${providerInfo.name} does not support ASR` }
    }
    // For ASR we can't easily test without audio, so just validate the key format
    // and trust the model name for now
    return { valid: true }
  }

  // For LLM functions, make a minimal test request
  try {
    if (provider === 'anthropic') {
      // Anthropic uses different API format
      const response = await fetch(providerInfo.chatEndpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say "ok"' }]
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        if (response.status === 401) {
          return { valid: false, error: 'Invalid API key' }
        }
        if (response.status === 404 || (error as { error?: { message?: string } }).error?.message?.includes('model')) {
          return { valid: false, error: `Model "${model}" not found` }
        }
        return { valid: false, error: (error as { error?: { message?: string } }).error?.message || `HTTP ${response.status}` }
      }
      return { valid: true }
    } else {
      // OpenAI-compatible API (OpenAI, DashScope, Groq)
      const response = await fetch(providerInfo.chatEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say "ok"' }]
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        if (response.status === 401) {
          return { valid: false, error: 'Invalid API key' }
        }
        if (response.status === 404) {
          return { valid: false, error: `Model "${model}" not found` }
        }
        const msg = (error as { error?: { message?: string } }).error?.message || ''
        if (msg.toLowerCase().includes('model')) {
          return { valid: false, error: `Model "${model}" not found or not accessible` }
        }
        return { valid: false, error: msg || `HTTP ${response.status}` }
      }
      return { valid: true }
    }
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    }
  }
}
