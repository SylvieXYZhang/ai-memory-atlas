// API Configuration for VoiceAgent
// Supports multiple providers and model assignments per function

export type Provider = 'dashscope' | 'openai' | 'anthropic' | 'groq'

export type FunctionType = 'asr' | 'intent' | 'summary' | 'research'

export interface ProviderConfig {
  id: Provider
  name: string
  endpoint: string
  models: ModelOption[]
  supportsASR: boolean
}

export interface ModelOption {
  id: string
  name: string
  description: string
  functions: FunctionType[] // which functions this model supports
}

export interface APIKeyConfig {
  provider: Provider
  key: string
}

export interface ModelAssignment {
  function: FunctionType
  provider: Provider
  model: string
}

export interface UserAPIConfig {
  keys: APIKeyConfig[]
  assignments: ModelAssignment[]
}

// Available providers and their models
export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'dashscope',
    name: 'Alibaba DashScope',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    supportsASR: true,
    models: [
      { id: 'qwen3-asr-flash', name: 'Qwen3 ASR Flash', description: 'Fast speech recognition', functions: ['asr'] },
      { id: 'qwen-max', name: 'Qwen Max', description: 'Most capable, best for research', functions: ['intent', 'summary', 'research'] },
      { id: 'qwen-plus', name: 'Qwen Plus', description: 'Balanced performance', functions: ['intent', 'summary', 'research'] },
      { id: 'qwen-turbo', name: 'Qwen Turbo', description: 'Fast and efficient', functions: ['intent', 'summary'] },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    supportsASR: true,
    models: [
      { id: 'whisper-1', name: 'Whisper', description: 'Speech recognition', functions: ['asr'] },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal', functions: ['intent', 'summary', 'research'] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', functions: ['intent', 'summary'] },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High capability', functions: ['intent', 'summary', 'research'] },
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    supportsASR: false,
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best for analysis', functions: ['intent', 'summary', 'research'] },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fast and efficient', functions: ['intent', 'summary'] },
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    supportsASR: true,
    models: [
      { id: 'whisper-large-v3', name: 'Whisper Large V3', description: 'Speech recognition', functions: ['asr'] },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'High capability', functions: ['intent', 'summary', 'research'] },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Ultra fast', functions: ['intent', 'summary'] },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Balanced MoE model', functions: ['intent', 'summary', 'research'] },
    ]
  }
]

// Default configuration
export const DEFAULT_CONFIG: UserAPIConfig = {
  keys: [],
  assignments: [
    { function: 'asr', provider: 'dashscope', model: 'qwen3-asr-flash' },
    { function: 'intent', provider: 'dashscope', model: 'qwen-max' },
    { function: 'summary', provider: 'dashscope', model: 'qwen-turbo' },
    { function: 'research', provider: 'dashscope', model: 'qwen-max' },
  ]
}

// Function display names
export const FUNCTION_INFO: Record<FunctionType, { name: string; description: string }> = {
  asr: { name: 'Speech Recognition', description: 'Convert voice to text' },
  intent: { name: 'Intent Detection', description: 'Classify as Publish or Note mode' },
  summary: { name: 'Summary Generation', description: 'Generate quick 200-word summary' },
  research: { name: 'Deep Research', description: 'Comprehensive analysis with web search' },
}

const STORAGE_KEY = 'voiceagent_api_config'

/**
 * Load API configuration from localStorage
 */
export function loadAPIConfig(): UserAPIConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const config = JSON.parse(saved) as UserAPIConfig
      // Merge with defaults to ensure all functions have assignments
      return {
        keys: config.keys || [],
        assignments: DEFAULT_CONFIG.assignments.map(defaultAssign => {
          const userAssign = config.assignments?.find(a => a.function === defaultAssign.function)
          return userAssign || defaultAssign
        })
      }
    }
  } catch (error) {
    console.error('[v0] Error loading API config:', error)
  }
  
  return DEFAULT_CONFIG
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
  return config.assignments.find(a => a.function === func) || DEFAULT_CONFIG.assignments.find(a => a.function === func)!
}

/**
 * Get provider config by ID
 */
export function getProvider(providerId: Provider): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === providerId)
}

/**
 * Check if a function has a valid configuration (API key set for its provider)
 */
export function isFunctionConfigured(config: UserAPIConfig, func: FunctionType): boolean {
  const assignment = getAssignment(config, func)
  const key = getAPIKey(config, assignment.provider)
  return !!key
}

/**
 * Get all functions that need configuration
 */
export function getUnconfiguredFunctions(config: UserAPIConfig): FunctionType[] {
  return (['asr', 'intent', 'summary', 'research'] as FunctionType[]).filter(
    func => !isFunctionConfigured(config, func)
  )
}
