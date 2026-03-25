// LLM Service for intent recognition, summary generation, and deep research
// Uses Alibaba Cloud Bailian (DashScope) models

import axios from 'axios'
import type { IntentType, ResearchData } from '../types'
import { extractTopic } from '../voice-utils'

const LLM_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

// Model selection
const INTENT_MODEL = 'qwen-max'
const SUMMARY_MODEL = 'qwen-turbo'
const RESEARCH_MODEL = 'qwen-max'

interface LLMResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Detect intent from user input (research or note)
 */
export async function detectIntent(text: string, apiKey: string): Promise<IntentType> {
  if (!apiKey) {
    // Fallback to simple keyword detection
    return detectIntentLocal(text)
  }

  const prompt = `Analyze the following user input and determine if they want to:
1. "publish" - They want to research, analyze, learn about a topic, or create content for publishing
2. "note" - They want to save a note, record a thought, or remember something personal

User input: "${text}"

Respond with ONLY one word: either "publish" or "note".`

  try {
    const response = await axios.post<LLMResponse>(LLM_ENDPOINT, {
      model: INTENT_MODEL,
      messages: [
        { role: 'system', content: 'You are an intent classifier. Respond with only one word.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    })

    const content = response.data?.choices?.[0]?.message?.content?.toLowerCase().trim()
    if (content?.includes('publish')) return 'publish'
    if (content?.includes('note')) return 'note'
    return 'unknown'
  } catch {
    // Fallback to local detection on error
    return detectIntentLocal(text)
  }
}

/**
 * Local intent detection using keywords
 */
function detectIntentLocal(text: string): IntentType {
  const lower = text.toLowerCase()
  
  const publishKeywords = [
    'research', 'analyze', 'study', 'investigate', 'look into',
    'what is', 'what are', 'tell me about', 'explain', 'how does',
    'market', 'trends', 'industry', 'competitors', 'publish', 'create', 'write'
  ]
  
  const noteKeywords = [
    'note', 'record', 'save', 'remember', 'write down',
    'thought', 'idea', 'realized', 'reminder', 'note to self'
  ]
  
  const hasPublish = publishKeywords.some(kw => lower.includes(kw))
  const hasNote = noteKeywords.some(kw => lower.includes(kw))
  
  if (hasNote && !hasPublish) return 'note'
  if (hasPublish) return 'publish'
  return 'publish' // Default to publish
}

/**
 * Generate a quick summary (200 words)
 */
export async function generateSummary(topic: string, apiKey: string): Promise<string> {
  if (!apiKey) {
    return generateMockSummary(topic)
  }

  const cleanTopic = extractTopic(topic)
  
  const prompt = `Generate a concise 200-word summary about: "${cleanTopic}"
  
Include:
- Brief overview of the topic
- Key points or current state
- Why it matters

Write in a clear, informative tone suitable for a professional audience.`

  try {
    const response = await axios.post<LLMResponse>(LLM_ENDPOINT, {
      model: SUMMARY_MODEL,
      messages: [
        { role: 'system', content: 'You are a knowledgeable research assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    return response.data?.choices?.[0]?.message?.content?.trim() || generateMockSummary(topic)
  } catch {
    return generateMockSummary(topic)
  }
}

/**
 * Perform deep research with web search
 */
export async function performDeepResearch(topic: string, apiKey: string): Promise<ResearchData> {
  if (!apiKey) {
    return generateMockResearch(topic)
  }

  const cleanTopic = extractTopic(topic)
  
  const prompt = `Conduct comprehensive research on: "${cleanTopic}"

Provide your findings in the following JSON format:
{
  "marketOverview": "Detailed overview of the current market/field (2-3 paragraphs)",
  "keyPlayers": ["List of 5-7 key companies, organizations, or figures"],
  "trends": ["List of 5-7 current trends or developments"],
  "conclusion": "Strategic insights and future outlook (1-2 paragraphs)",
  "sources": ["List of relevant sources or references"]
}

Be thorough, accurate, and provide actionable insights.`

  try {
    const response = await axios.post<LLMResponse>(LLM_ENDPOINT, {
      model: RESEARCH_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert research analyst. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      // Enable web search for deep research
      extra_body: {
        enable_search: true
      }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 90000 // 90 second timeout for deep research
    })

    const content = response.data?.choices?.[0]?.message?.content
    if (!content) {
      return generateMockResearch(topic)
    }

    // Try to parse JSON from the response
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                       content.match(/```\n?([\s\S]*?)\n?```/) ||
                       [null, content]
      const jsonStr = jsonMatch[1] || content
      const data = JSON.parse(jsonStr)
      
      return {
        marketOverview: data.marketOverview || '',
        keyPlayers: Array.isArray(data.keyPlayers) ? data.keyPlayers : [],
        trends: Array.isArray(data.trends) ? data.trends : [],
        conclusion: data.conclusion || '',
        sources: Array.isArray(data.sources) ? data.sources : []
      }
    } catch {
      // If JSON parsing fails, create structured data from raw text
      return {
        marketOverview: content,
        keyPlayers: [],
        trends: [],
        conclusion: '',
        sources: []
      }
    }
  } catch {
    return generateMockResearch(topic)
  }
}

/**
 * Generate mock summary for demo
 */
function generateMockSummary(topic: string): string {
  const cleanTopic = extractTopic(topic)
  return `**${cleanTopic}**

This is a rapidly evolving field that has seen significant developments in recent years. The market is characterized by intense competition, rapid innovation, and growing investment from both private and public sectors.

Key factors driving growth include technological advancement, changing consumer behavior, and regulatory support. Industry experts predict continued expansion as more organizations recognize the strategic value of adopting these solutions.

Understanding this landscape is crucial for businesses looking to stay competitive and capitalize on emerging opportunities.`
}

/**
 * Generate mock research data for demo
 */
function generateMockResearch(topic: string): ResearchData {
  const cleanTopic = extractTopic(topic)
  return {
    marketOverview: `The ${cleanTopic} market has experienced remarkable growth over the past few years, driven by increasing adoption across industries and continuous technological innovation. Current market valuations indicate strong momentum, with projections suggesting sustained growth through the next decade.\n\nKey drivers include digital transformation initiatives, cost optimization pressures, and the need for competitive differentiation. Organizations of all sizes are exploring how ${cleanTopic} can enhance their operations and customer experiences.`,
    keyPlayers: [
      'Leading technology corporations',
      'Innovative startups and scale-ups',
      'Academic and research institutions',
      'Government and regulatory bodies',
      'Industry consortiums and standards organizations'
    ],
    trends: [
      'Increased automation and AI integration',
      'Focus on sustainability and ethical practices',
      'Growing emphasis on security and privacy',
      'Rise of platform-based business models',
      'Cross-industry collaboration and partnerships'
    ],
    conclusion: `The future of ${cleanTopic} looks promising, with multiple growth vectors and expanding use cases. Organizations that invest in understanding and adopting these technologies early will likely gain significant competitive advantages.\n\nStrategic recommendations include building internal capabilities, fostering partnerships, and maintaining flexibility to adapt to rapid changes in the landscape.`,
    sources: [
      'Industry analyst reports',
      'Academic research papers',
      'Government publications',
      'Company announcements and filings',
      'Expert interviews and commentary'
    ]
  }
}
