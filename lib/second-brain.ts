import { classifyPromptPurpose, type MemoryRepresentation, type PromptClassification, type PromptPurpose } from '@/lib/memory-atlas/prompt-classifier'

export type BrainNodeType = 'idea' | 'project' | 'question' | 'task' | 'artifact' | 'source'

export interface MemoryEvent {
  id: string
  surface: string
  userInput: string
  aiOutput: string
  extracted: string[]
  graphDelta: string
  url?: string
  capturedAt: number
  source: 'manual' | 'voice' | 'extension' | 'api' | 'agent'
  captureMethod?: 'manual' | 'voice' | 'dom' | 'network' | 'webhook' | 'codex-hook' | 'claude-code-hook'
  provider?: 'codex' | 'claude-code' | 'unknown-agent'
  sessionId?: string
  turnId?: string
  cwd?: string
  model?: string
  transcriptPath?: string
  promptPurpose: PromptPurpose
  memoryRepresentation: MemoryRepresentation
  classificationConfidence: number
  classificationRationale: string
  boundarySignals: string[]
}

export interface IngestPayload {
  surface?: string
  userInput?: string
  aiOutput?: string
  url?: string
  source?: MemoryEvent['source']
  captureMethod?: MemoryEvent['captureMethod']
  rawRequest?: string
  rawResponse?: string
  transport?: 'dom' | 'fetch' | 'xhr' | 'eventsource' | 'websocket' | 'webhook' | 'manual'
  provider?: MemoryEvent['provider']
  sessionId?: string
  turnId?: string
  cwd?: string
  model?: string
  transcriptPath?: string
  toolCalls?: AgentToolCall[]
  rawHookEvent?: unknown
  promptPurpose?: PromptPurpose
}

export interface AgentToolCall {
  id?: string
  name: string
  input?: unknown
  output?: unknown
  status?: string
}

export interface RawCaptureRecord {
  id: string
  surface: string
  url?: string
  source: MemoryEvent['source']
  captureMethod?: MemoryEvent['captureMethod']
  transport?: IngestPayload['transport']
  rawRequest?: string
  rawResponse?: string
  userInput?: string
  aiOutput?: string
  provider?: MemoryEvent['provider']
  sessionId?: string
  turnId?: string
  cwd?: string
  model?: string
  transcriptPath?: string
  toolCalls?: AgentToolCall[]
  rawHookEvent?: unknown
  promptPurpose: PromptPurpose
  memoryRepresentation: MemoryRepresentation
  classificationConfidence: number
  classificationRationale: string
  boundarySignals: string[]
  capturedAt: number
}

export interface IngestionRecord {
  id: string
  eventId: string
  sourceRecordId: string
  surface: string
  observations: string[]
  interpretations: string[]
  candidateTopics: string[]
  promptPurpose: PromptPurpose
  memoryRepresentation: MemoryRepresentation
  classification: {
    confidence: number
    rationale: string
    boundarySignals: string[]
  }
  provenance: {
    source: MemoryEvent['source']
    captureMethod?: MemoryEvent['captureMethod']
    url?: string
    provider?: MemoryEvent['provider']
    sessionId?: string
    turnId?: string
    cwd?: string
    model?: string
    transcriptPath?: string
  }
  createdAt: number
}

export const SECOND_BRAIN_STORAGE_KEY = 'second_brain_demo_events'

export const starterEvents: MemoryEvent[] = [
  {
    id: 'evt-openclaw',
    surface: 'OpenClaw',
    userInput: 'Use OpenClaw to inspect my workflow and tell me where an agent memory layer would help.',
    aiOutput: 'The agent should remember repeated user intents, generated artifacts, accepted plans, and failed actions so future tasks start with project context.',
    extracted: ['agent memory layer', 'accepted plans', 'failed action traces'],
    graphDelta: '+3 nodes, +4 links',
    capturedAt: Date.now() - 1000 * 60 * 24,
    source: 'api',
    captureMethod: 'webhook',
    promptPurpose: 'thinking',
    memoryRepresentation: 'thinking_map',
    classificationConfidence: 0.82,
    classificationRationale: 'The exchange explores where an agent memory layer would extend future AI collaboration.',
    boundarySignals: ['knowledge-boundary', 'framework-building'],
  },
  {
    id: 'evt-chatgpt',
    surface: 'ChatGPT',
    userInput: 'Turn every AI conversation into reusable knowledge, not another lost chat transcript.',
    aiOutput: 'The sharp wedge is a second brain for AI conversations: capture prompts, outputs, decisions, tasks, and open questions automatically.',
    extracted: ['AI conversation memory', 'decisions', 'open questions'],
    graphDelta: '+4 nodes, +5 links',
    capturedAt: Date.now() - 1000 * 60 * 12,
    source: 'extension',
    captureMethod: 'dom',
    promptPurpose: 'thinking',
    memoryRepresentation: 'thinking_map',
    classificationConfidence: 0.84,
    classificationRationale: 'The exchange frames a product thesis about turning AI conversations into reusable knowledge.',
    boundarySignals: ['framework-building'],
  },
  {
    id: 'evt-cursor',
    surface: 'Cursor',
    userInput: 'Refactor the old voice assistant into a graph-first product demo.',
    aiOutput: 'Keep voice as the input layer, then show graph assets and expansion recommendations as the long-term value.',
    extracted: ['voice entry', 'graph asset', 'boundary expansion'],
    graphDelta: '+3 nodes, +3 links',
    capturedAt: Date.now() - 1000 * 60 * 5,
    source: 'manual',
    captureMethod: 'manual',
    promptPurpose: 'tool',
    memoryRepresentation: 'markdown',
    classificationConfidence: 0.78,
    classificationRationale: 'The exchange asks AI to refactor a concrete product demo.',
    boundarySignals: ['result-preference'],
  },
]

export function extractConcepts(input: string, output: string): string[] {
  const text = `${input} ${output}`.toLowerCase()
  const preferred = [
    'openclaw',
    'second brain',
    'knowledge graph',
    'voice input',
    'agent memory',
    'capture',
    'privacy',
    'boundary expansion',
    'tasks',
    'decisions',
    'artifacts',
    'ai conversations',
    'chatgpt',
    'claude',
    'cursor',
    'codex',
    'claude code',
    'mcp',
    'browser plugin',
    'hook',
    'transcript',
    'tool call',
    'tests',
    'build',
    'typescript',
    'api route',
  ]
  const matches = preferred.filter((term) => text.includes(term))
  const fallback = input
    .replace(/[?.!。？！,，]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 3)

  return Array.from(new Set([...matches, ...fallback])).slice(0, 6)
}

export function createMemoryEvent(payload: IngestPayload): MemoryEvent {
  const userInput = payload.userInput?.trim() || 'Captured AI interaction'
  const aiOutput = payload.aiOutput?.trim() || 'No AI response captured yet.'
  const inferred = classifyPromptPurpose(userInput, aiOutput)
  const classification: PromptClassification = payload.promptPurpose
    ? {
        ...inferred,
        purpose: payload.promptPurpose,
        representation: payload.promptPurpose === 'tool'
          ? 'markdown'
          : payload.promptPurpose === 'knowledge'
            ? 'knowledge_graph'
            : 'thinking_map',
        rationale: `Explicitly classified as ${payload.promptPurpose}. ${inferred.rationale}`,
      }
    : inferred
  const extracted = extractConcepts(userInput, aiOutput)

  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    surface: payload.surface?.trim() || inferSurface(payload.url) || 'AI Surface',
    userInput,
    aiOutput,
    extracted: extracted.length ? extracted : ['captured interaction'],
    graphDelta: `+${Math.max(1, extracted.length)} nodes, +${Math.max(2, extracted.length + 1)} links`,
    url: payload.url,
    capturedAt: Date.now(),
    source: payload.source || 'api',
    captureMethod: inferCaptureMethod(payload),
    provider: payload.provider,
    sessionId: payload.sessionId,
    turnId: payload.turnId,
    cwd: payload.cwd,
    model: payload.model,
    transcriptPath: payload.transcriptPath,
    promptPurpose: classification.purpose,
    memoryRepresentation: classification.representation,
    classificationConfidence: classification.confidence,
    classificationRationale: classification.rationale,
    boundarySignals: classification.boundarySignals,
  }
}

export function createRawCaptureRecord(payload: IngestPayload): RawCaptureRecord {
  const inferred = classifyPromptPurpose(payload.userInput, payload.aiOutput)
  const classification: PromptClassification = payload.promptPurpose
    ? {
        ...inferred,
        purpose: payload.promptPurpose,
        representation: payload.promptPurpose === 'tool'
          ? 'markdown'
          : payload.promptPurpose === 'knowledge'
            ? 'knowledge_graph'
            : 'thinking_map',
      }
    : inferred
  return {
    id: `raw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    surface: payload.surface?.trim() || inferSurface(payload.url) || 'AI Surface',
    url: payload.url,
    source: payload.source || 'api',
    captureMethod: payload.captureMethod,
    transport: payload.transport,
    rawRequest: payload.rawRequest,
    rawResponse: payload.rawResponse,
    userInput: payload.userInput,
    aiOutput: payload.aiOutput,
    provider: payload.provider,
    sessionId: payload.sessionId,
    turnId: payload.turnId,
    cwd: payload.cwd,
    model: payload.model,
    transcriptPath: payload.transcriptPath,
    toolCalls: payload.toolCalls,
    rawHookEvent: payload.rawHookEvent,
    promptPurpose: classification.purpose,
    memoryRepresentation: classification.representation,
    classificationConfidence: classification.confidence,
    classificationRationale: classification.rationale,
    boundarySignals: classification.boundarySignals,
    capturedAt: Date.now(),
  }
}

export function createIngestionRecord(event: MemoryEvent, sourceRecord: RawCaptureRecord): IngestionRecord {
  const observations = [
    `User asked: ${event.userInput}`,
    `AI answered: ${event.aiOutput}`,
  ]
  const interpretations = event.extracted.map((topic) => `Possible durable topic: ${topic}`)

  return {
    id: `ing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventId: event.id,
    sourceRecordId: sourceRecord.id,
    surface: event.surface,
    observations,
    interpretations,
    candidateTopics: event.extracted,
    promptPurpose: event.promptPurpose,
    memoryRepresentation: event.memoryRepresentation,
    classification: {
      confidence: event.classificationConfidence,
      rationale: event.classificationRationale,
      boundarySignals: event.boundarySignals,
    },
    provenance: {
      source: event.source,
      captureMethod: event.captureMethod,
      url: event.url,
      provider: event.provider,
      sessionId: event.sessionId,
      turnId: event.turnId,
      cwd: event.cwd,
      model: event.model,
      transcriptPath: event.transcriptPath,
    },
    createdAt: Date.now(),
  }
}

export function inferSurface(url?: string): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname
    if (host.includes('chatgpt') || host.includes('openai')) return 'ChatGPT'
    if (host.includes('claude')) return 'Claude'
    if (host.includes('cursor')) return 'Cursor'
    if (host.includes('openclaw')) return 'OpenClaw'
    return host.replace(/^www\./, '')
  } catch {
    return null
  }
}

function inferCaptureMethod(payload: IngestPayload): MemoryEvent['captureMethod'] {
  if (payload.captureMethod) return payload.captureMethod
  if (payload.provider === 'codex') return 'codex-hook'
  if (payload.provider === 'claude-code') return 'claude-code-hook'
  if (payload.source === 'extension') return 'dom'
  if (payload.source === 'api') return 'webhook'
  if (payload.source === 'agent') return 'webhook'
  return payload.source
}

export function mergeEvents(existing: MemoryEvent[], incoming: MemoryEvent[]): MemoryEvent[] {
  const seen = new Set<string>()
  return [...incoming, ...existing]
    .filter((event) => {
      const key = `${event.surface}|${event.userInput}|${event.aiOutput}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, 50)
}
