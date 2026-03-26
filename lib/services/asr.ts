// ASR (Automatic Speech Recognition) Service
// Supports multiple providers: DashScope, OpenAI, Groq

import { blobToBase64 } from '../voice-utils'
import { type Provider, getProviderInfo } from '../api-config'

// Hot words for better recognition of tech terms (bilingual)
const HOT_WORDS = [
  // English
  'AI', 'LLM', 'RAG', 'VoiceAgent', 'Transformer', 'GPT', 'API', 'SDK', 'SaaS', 'B2B', 'B2C',
  // Chinese
  '人工智能', '大模型', '深度学习', '机器学习', '自然语言处理', '语音识别', '知识库', '向量数据库'
]

interface DashScopeASRResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface OpenAIASRResponse {
  text: string
}

/**
 * Convert audio blob to text using the configured provider and model
 */
export async function transcribeAudio(
  audioBlob: Blob, 
  apiKey: string,
  provider: Provider = 'dashscope',
  model: string = 'qwen3-asr-flash'
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required for ASR')
  }

  const providerInfo = getProviderInfo(provider)

  if (provider === 'dashscope') {
    return transcribeDashScope(audioBlob, apiKey, model)
  } else if (provider === 'openai' || provider === 'groq') {
    return transcribeOpenAICompatible(audioBlob, apiKey, model, providerInfo.asrEndpoint!)
  } else {
    throw new Error(`ASR not supported for provider: ${provider}`)
  }
}

/**
 * Transcribe using DashScope (Qwen3-ASR)
 */
async function transcribeDashScope(audioBlob: Blob, apiKey: string, model: string): Promise<string> {
  const providerInfo = getProviderInfo('dashscope')
  const base64Audio = await blobToBase64(audioBlob)

  const payload = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: base64Audio
            }
          }
        ]
      }
    ],
    asr_options: {
      enable_itn: true,
      hot_words: HOT_WORDS.join(',')
    }
  }

  const response = await fetch(providerInfo.chatEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your configuration.')
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait and try again.')
    }
    throw new Error(`ASR error: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`)
  }

  const data = await response.json() as DashScopeASRResponse
  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('No transcription returned from ASR')
  }

  return content.trim()
}

/**
 * Transcribe using OpenAI-compatible API (OpenAI, Groq)
 */
async function transcribeOpenAICompatible(
  audioBlob: Blob, 
  apiKey: string, 
  model: string,
  endpoint: string
): Promise<string> {
  // OpenAI/Groq Whisper API uses multipart form data
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.webm')
  formData.append('model', model)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your configuration.')
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait and try again.')
    }
    throw new Error(`ASR error: ${(error as { error?: { message?: string } }).error?.message || response.statusText}`)
  }

  const data = await response.json() as OpenAIASRResponse
  if (!data.text) {
    throw new Error('No transcription returned from ASR')
  }

  return data.text.trim()
}

/**
 * Mock ASR for demo/testing when no API key is available
 */
export async function mockTranscribeAudio(durationMs: number): Promise<string> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const mockResponses = [
    'Research the current state of artificial intelligence in healthcare',
    'Help me note down my idea about building a sustainable energy startup',
    'Analyze the market trends for electric vehicles in 2024',
    'I just thought of a great feature for our app - voice-controlled navigation',
    'Research how blockchain technology is being used in supply chain management'
  ]
  
  return mockResponses[Math.floor(Math.random() * mockResponses.length)]
}
