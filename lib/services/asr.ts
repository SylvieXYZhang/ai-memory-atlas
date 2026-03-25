// ASR (Automatic Speech Recognition) Service
// Uses Alibaba Cloud Bailian (DashScope) qwen3-asr-flash model

import axios from 'axios'
import { blobToBase64 } from '../voice-utils'

const ASR_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const ASR_MODEL = 'qwen3-asr-flash'

// Hot words for better recognition of tech terms
const HOT_WORDS = ['AI', 'LLM', 'RAG', 'VoiceAgent', 'Transformer', 'GPT', 'API', 'SDK', 'SaaS', 'B2B', 'B2C']

interface ASRResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Convert audio blob to text using Qwen3-ASR-Flash
 */
export async function transcribeAudio(audioBlob: Blob, apiKey: string): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required for ASR')
  }

  // Convert audio to base64
  const base64Audio = await blobToBase64(audioBlob)

  const payload = {
    model: ASR_MODEL,
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

  try {
    const response = await axios.post<ASRResponse>(ASR_ENDPOINT, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    })

    const content = response.data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('No transcription returned from ASR')
    }

    return content.trim()
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('ASR request timed out. Please try again.')
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid API key. Please check your configuration.')
      }
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.')
      }
      throw new Error(`ASR error: ${error.response?.data?.error?.message || error.message}`)
    }
    throw error
  }
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
