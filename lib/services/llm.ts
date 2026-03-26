// LLM Service for intent recognition, summary generation, and deep research
// Supports multiple providers: DashScope, OpenAI, Anthropic, Groq

import type { IntentType, ResearchData } from '../types'
import { extractTopic } from '../voice-utils'
import { type Provider, getProviderInfo } from '../api-config'

interface OpenAILLMResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface AnthropicLLMResponse {
  content: Array<{
    text: string
  }>
}

/**
 * Call LLM with the configured provider and model
 */
async function callLLM(
  provider: Provider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number; enableSearch?: boolean } = {}
): Promise<string> {
  const providerInfo = getProviderInfo(provider)
  const { temperature = 0.7, maxTokens = 2000, enableSearch = false } = options

  if (provider === 'anthropic') {
    // Anthropic uses a different API format
    const response = await fetch(providerInfo.chatEndpoint, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: { message?: string } }).error?.message || `HTTP ${response.status}`)
    }

    const data = await response.json() as AnthropicLLMResponse
    return data.content?.[0]?.text || ''
  } else {
    // OpenAI-compatible API (OpenAI, DashScope, Groq)
    const body: Record<string, unknown> = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }

    // DashScope supports web search
    if (provider === 'dashscope' && enableSearch) {
      body.extra_body = { enable_search: true }
    }

    const response = await fetch(providerInfo.chatEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: { message?: string } }).error?.message || `HTTP ${response.status}`)
    }

    const data = await response.json() as OpenAILLMResponse
    return data.choices?.[0]?.message?.content || ''
  }
}

/**
 * Detect intent from user input (research or note)
 */
export async function detectIntent(
  text: string, 
  apiKey: string,
  provider: Provider = 'dashscope',
  model: string = 'qwen-max'
): Promise<IntentType> {
  if (!apiKey) {
    // Fallback to simple keyword detection
    return detectIntentLocal(text)
  }

  const prompt = `Analyze the following user input and determine their intent:
分析以下用户输入并判断其意图：

1. "publish" - They want to research, analyze, learn about a topic, or create content for publishing
   用户想要研究、分析、了解某个话题，或创建用于发布的内容
2. "note" - They want to save a note, record a thought, or remember something personal
   用户想要保存笔记、记录想法或记住个人事项

User input / 用户输入: "${text}"

Respond with ONLY one word: either "publish" or "note".
只回复一个词："publish" 或 "note"。`

  try {
    const content = await callLLM(
      provider, 
      apiKey, 
      model,
      'You are an intent classifier. Respond with only one word: "publish" or "note". 你是一个意图分类器，只回复一个词："publish" 或 "note"。',
      prompt,
      { temperature: 0.1, maxTokens: 10 }
    )

    const result = content.toLowerCase().trim()
    if (result.includes('publish')) return 'publish'
    if (result.includes('note')) return 'note'
    return 'unknown'
  } catch {
    // Fallback to local detection on error
    return detectIntentLocal(text)
  }
}

/**
 * Local intent detection using keywords (bilingual: English + Chinese)
 */
function detectIntentLocal(text: string): IntentType {
  const lower = text.toLowerCase()
  
  // English keywords
  const publishKeywordsEN = [
    'research', 'analyze', 'study', 'investigate', 'look into',
    'what is', 'what are', 'tell me about', 'explain', 'how does',
    'market', 'trends', 'industry', 'competitors', 'publish', 'create', 'write'
  ]
  
  const noteKeywordsEN = [
    'note', 'record', 'save', 'remember', 'write down',
    'thought', 'idea', 'realized', 'reminder', 'note to self'
  ]

  // Chinese keywords
  const publishKeywordsCN = [
    '研究', '分析', '调研', '调查', '了解', '查一下', '查查',
    '什么是', '是什么', '怎么', '如何', '告诉我', '解释',
    '市场', '趋势', '行业', '竞争', '发布', '创建', '写', '撰写'
  ]
  
  const noteKeywordsCN = [
    '笔记', '记录', '保存', '记住', '写下', '备忘',
    '想法', '灵感', '突然想到', '提醒', '记一下', '记下来', '备注'
  ]
  
  const hasPublishEN = publishKeywordsEN.some(kw => lower.includes(kw))
  const hasNoteEN = noteKeywordsEN.some(kw => lower.includes(kw))
  const hasPublishCN = publishKeywordsCN.some(kw => text.includes(kw))
  const hasNoteCN = noteKeywordsCN.some(kw => text.includes(kw))
  
  const hasPublish = hasPublishEN || hasPublishCN
  const hasNote = hasNoteEN || hasNoteCN
  
  if (hasNote && !hasPublish) return 'note'
  if (hasPublish) return 'publish'
  return 'publish' // Default to publish
}

/**
 * Generate a quick summary (200 words)
 * Responds in the same language as the input
 */
export async function generateSummary(
  topic: string, 
  apiKey: string,
  provider: Provider = 'dashscope',
  model: string = 'qwen-turbo'
): Promise<string> {
  if (!apiKey) {
    return generateMockSummary(topic)
  }

  const cleanTopic = extractTopic(topic)
  
  const prompt = `Generate a concise 200-word summary about: "${cleanTopic}"
针对以下主题生成约200字的简洁摘要："${cleanTopic}"

Include / 包含:
- Brief overview of the topic / 话题概述
- Key points or current state / 关键要点或现状
- Why it matters / 重要性

IMPORTANT: Detect the language of the topic and respond in the SAME language.
重要：检测主题的语言，并用相同的语言回复。
- If the topic is in English, respond entirely in English.
- 如果主题是中文，请完全用中文回复。`

  try {
    const content = await callLLM(
      provider,
      apiKey,
      model,
      'You are a knowledgeable research assistant. Detect the input language and respond in the same language. 你是一位知识渊博的研究助手。检测输入语言并用相同语言回复。',
      prompt,
      { temperature: 0.7, maxTokens: 800 }
    )
    return content || generateMockSummary(topic)
  } catch {
    return generateMockSummary(topic)
  }
}

/**
 * Perform deep research with web search
 * Responds in the same language as the input
 */
export async function performDeepResearch(
  topic: string, 
  apiKey: string,
  provider: Provider = 'dashscope',
  model: string = 'qwen-max'
): Promise<ResearchData> {
  if (!apiKey) {
    return generateMockResearch(topic)
  }

  const cleanTopic = extractTopic(topic)
  
  const prompt = `Conduct comprehensive research on / 针对以下主题进行全面研究: "${cleanTopic}"

Provide your findings in the following JSON format / 以下列JSON格式提供你的研究结果:
{
  "marketOverview": "Detailed overview of the current market/field (2-3 paragraphs) / 当前市场/领域的详细概述（2-3段）",
  "keyPlayers": ["List of 5-7 key companies, organizations, or figures / 5-7个关键公司、组织或人物列表"],
  "trends": ["List of 5-7 current trends or developments / 5-7个当前趋势或发展列表"],
  "conclusion": "Strategic insights and future outlook (1-2 paragraphs) / 战略见解和未来展望（1-2段）",
  "sources": ["List of relevant sources or references / 相关来源或参考文献列表"]
}

IMPORTANT / 重要:
- Detect the language of the topic and write ALL content in the SAME language.
- 检测主题的语言，并用相同的语言撰写所有内容。
- If the topic is in English, all values in the JSON should be in English.
- 如果主题是中文，JSON中的所有值都应该是中文。
- Be thorough, accurate, and provide actionable insights.
- 要全面、准确，并提供可操作的见解。`

  try {
    const content = await callLLM(
      provider,
      apiKey,
      model,
      'You are an expert research analyst. Always respond with valid JSON. Detect input language and respond in the same language. 你是专业的研究分析师，始终返回有效的JSON。检测输入语言并用相同语言回复。',
      prompt,
      { temperature: 0.7, maxTokens: 4000, enableSearch: true }
    )

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
