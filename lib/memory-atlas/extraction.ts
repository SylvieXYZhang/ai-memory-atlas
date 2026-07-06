import type { MemoryEvent } from '@/lib/second-brain'
import type { MemoryCandidate, MemoryCandidateReview, MemoryEdge, MemoryNode, MockAiChat } from './types'
import { shouldEnterGraph } from './prompt-classifier'

const dynamicTypes = [
  'idea',
  'decision',
  'task',
  'artifact',
  'question',
  'preference',
] as const

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'memory'
}

function inferNodeType(text: string, index: number): MemoryNode['type'] {
  const normalized = text.toLowerCase()
  if (/[?？]|question|open question|疑问|问题/.test(normalized)) return 'question'
  if (/decision|decide|choose|ship|rollback|accept|选择|判断|方向|定位/.test(normalized)) return 'decision'
  if (/fail|error|exception|regression|broken|test failed|build failed/.test(normalized)) return 'failure'
  if (/codex|claude code|playwright|npm|git|mcp|api route|hook|tool call|typescript/.test(normalized)) return 'tool'
  if (/task|todo|next|build|implement|fix|ship|实现|开发|待办/.test(normalized)) return 'task'
  if (/artifact|demo|export|doc|file|path|script|route|component|作品|产出|原型/.test(normalized)) return 'artifact'
  if (/prefer|preference|taste|偏好|喜欢|倾向/.test(normalized)) return 'preference'
  return dynamicTypes[index % dynamicTypes.length]
}

function summarize(text: string, fallback: string) {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return fallback
  return compact.length > 150 ? `${compact.slice(0, 150)}...` : compact
}

function conceptTitle(value: string) {
  const compact = value.trim()
  if (!compact) return 'Captured Memory'
  return compact
    .split(/\s+/)
    .slice(0, 8)
    .join(' ')
    .replace(/^[a-z]/, (char) => char.toUpperCase())
}

function isUsefulConcept(value: string) {
  const compact = value.trim()
  const lower = compact.toLowerCase()
  const stopConcepts = new Set([
    'chatgpt',
    'claude',
    'cursor',
    'openclaw',
    'assistant',
    'browser',
    'local',
    'fetch',
    'conversation',
  ])
  if (stopConcepts.has(lower)) return false
  if (compact.length < 2 || compact.length > 80) return false
  if (compact.startsWith('{') || compact.startsWith('[')) return false
  if (/https?:|node_modules|app-client|webpack|turbopack|\[project\]|session_id|referrer|segmentio|datadog|websockettopic|moreShow/i.test(compact)) {
    return false
  }
  if (/^[a-z]+$/i.test(compact) && compact.length < 5 && !['mcp', 'api'].includes(lower)) return false
  return true
}

function fallbackConcept(event: MemoryEvent) {
  const text = event.userInput
    .replace(/[{}[\]"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!isUsefulConcept(text.slice(0, 80))) return null
  return text.length > 40 ? text.slice(0, 40) : text
}

export function eventsToMockChats(events: MemoryEvent[]): MockAiChat[] {
  return events.map((event) => ({
    id: `live-chat-${event.id}`,
    surface: event.surface,
    title: summarize(event.extracted[0] || event.userInput, 'Captured AI interaction'),
    userMessage: event.userInput,
    aiMessage: event.aiOutput,
    capturedAt: new Date(event.capturedAt).toISOString(),
    projectId: 'project-atlas',
    extractedNodeIds: event.extracted.map((concept, index) => `live-node-${event.id}-${slugify(concept)}-${index}`),
    sessionId: event.sessionId,
    turnId: event.turnId,
    cwd: event.cwd,
    model: event.model,
    transcriptPath: event.transcriptPath,
    provider: event.provider,
    promptPurpose: event.promptPurpose || 'thinking',
    memoryRepresentation: event.memoryRepresentation || 'thinking_map',
    boundarySignals: event.boundarySignals || [],
  }))
}

export function eventsToMemoryCandidates(events: MemoryEvent[], reviews: MemoryCandidateReview[] = []): MemoryCandidate[] {
  const reviewById = new Map(reviews.map((review) => [review.id, review]))
  const preparedEvents = events
    .filter((event) => shouldEnterGraph(event))
    .map((event) => {
      const concepts = event.extracted.filter(isUsefulConcept).slice(0, 4)
      const fallback = fallbackConcept(event)
      return {
        event,
        concepts: concepts.length ? concepts : fallback ? [fallback] : [],
      }
    })
    .filter((item) => item.concepts.length > 0)
    .slice(0, 14)

  return preparedEvents.flatMap(({ event, concepts }) => {
    const chatId = `live-chat-${event.id}`
      const sourceChat: MockAiChat = {
      id: chatId,
      surface: event.surface,
      title: summarize(concepts[0] || event.userInput, 'Captured AI interaction'),
      userMessage: event.userInput,
      aiMessage: event.aiOutput,
      capturedAt: new Date(event.capturedAt).toISOString(),
      projectId: 'project-atlas',
      extractedNodeIds: concepts.map((concept, index) => `live-node-${event.id}-${slugify(concept)}-${index}`),
      sessionId: event.sessionId,
      turnId: event.turnId,
      cwd: event.cwd,
      model: event.model,
      transcriptPath: event.transcriptPath,
      provider: event.provider,
      promptPurpose: event.promptPurpose || 'thinking',
      memoryRepresentation: event.memoryRepresentation || 'thinking_map',
      boundarySignals: event.boundarySignals || [],
    }

    return concepts.map((concept, conceptIndex) => {
      const id = `cand-${event.id}-${slugify(concept)}-${conceptIndex}`
      const review = reviewById.get(id)
      const type = review?.type || inferNodeType(`${concept} ${event.userInput} ${event.aiOutput}`, conceptIndex)
      const summary = review?.summary || summarize(event.aiOutput, 'Captured from a live AI interaction.')
      const title = review?.title || conceptTitle(concept)

      return {
        id,
        eventId: event.id,
        status: review?.status || 'pending',
        surface: event.surface,
        title,
        type,
        summary,
        evidence: [
          `${event.promptPurpose === 'knowledge' ? 'Knowledge graph' : 'Thinking map'}: ${event.classificationRationale || 'Classified as graph-worthy memory.'}`,
          event.boundarySignals?.length ? `Boundary signals: ${event.boundarySignals.join(', ')}` : '',
          summarize(event.userInput, 'User prompt captured.'),
          summarize(event.aiOutput, 'AI response captured.'),
          event.sessionId ? `Session: ${event.sessionId}` : '',
          event.cwd ? `Workspace: ${event.cwd}` : '',
          event.transcriptPath ? `Transcript: ${event.transcriptPath}` : '',
        ].filter(Boolean),
        confidence: Math.max(0.62, 0.82 - conceptIndex * 0.04),
        promptPurpose: event.promptPurpose || 'thinking',
        memoryRepresentation: event.memoryRepresentation || 'thinking_map',
        boundarySignals: event.boundarySignals || [],
        createdAt: new Date(event.capturedAt).toISOString(),
        sourceChat,
      } satisfies MemoryCandidate
    })
  })
}

export function candidatesToMemoryGraph(candidates: MemoryCandidate[]): { nodes: MemoryNode[]; edges: MemoryEdge[]; chats: MockAiChat[] } {
  const accepted = candidates.filter((candidate) => candidate.status === 'accepted')
  const nodes: MemoryNode[] = []
  const edges: MemoryEdge[] = []
  const chatsById = new Map<string, MockAiChat>()

  accepted.forEach((candidate, eventIndex) => {
    const chatId = candidate.sourceChat.id
    chatsById.set(chatId, candidate.sourceChat)
    const angleBase = eventIndex * 0.9
    const angle = angleBase + (nodes.length % 4) * 0.72
    const radius = 250 + (nodes.length % 3) * 52
    const nodeId = `live-node-${candidate.id.replace(/^cand-/, '')}`
    const x = Math.round(520 + Math.cos(angle) * radius)
    const y = Math.round(330 + Math.sin(angle) * radius)

    nodes.push({
      id: nodeId,
      type: candidate.type,
      title: candidate.title,
      summary: candidate.summary,
      evidence: candidate.evidence,
      confidence: candidate.confidence,
      createdAt: candidate.createdAt,
      updatedAt: candidate.createdAt,
      x,
      y,
      sourceChatIds: [chatId],
    })

    edges.push({
      id: `live-edge-project-${nodeId}`,
      from: nodeId,
      to: 'project-atlas',
      type: 'generated_from',
      evidence: `Accepted from ${candidate.surface}`,
    })
  })

  return { nodes, edges, chats: Array.from(chatsById.values()) }
}

export function eventsToMemoryGraph(events: MemoryEvent[], reviews: MemoryCandidateReview[] = []): { nodes: MemoryNode[]; edges: MemoryEdge[]; chats: MockAiChat[] } {
  return candidatesToMemoryGraph(eventsToMemoryCandidates(events, reviews))
}
