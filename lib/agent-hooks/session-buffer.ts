import type { IngestPayload } from '@/lib/second-brain'
import type { AgentToolCall } from '@/lib/second-brain'
import type { BufferedAgentInteraction, NormalizedAgentHook } from './types'

interface BufferedSession {
  provider: NormalizedAgentHook['provider']
  surface: string
  captureMethod: NormalizedAgentHook['captureMethod']
  userInput?: string
  aiOutput?: string
  rawRequest?: string
  rawResponse?: string
  sessionId?: string
  turnId?: string
  cwd?: string
  model?: string
  transcriptPath?: string
  toolCalls?: AgentToolCall[]
  updatedAt: number
  rawHookEvents: unknown[]
}

const sessions = new Map<string, BufferedSession>()
const TTL_MS = 1000 * 60 * 60

function sessionKey(hook: NormalizedAgentHook) {
  return [
    hook.provider,
    hook.sessionId || hook.cwd || 'session',
    hook.turnId || 'latest',
  ].join(':')
}

function compactRawEvents(events: unknown[]) {
  return events.slice(-8)
}

function pruneExpiredSessions() {
  const now = Date.now()
  for (const [key, session] of sessions) {
    if (now - session.updatedAt > TTL_MS) sessions.delete(key)
  }
}

function toPayload(session: BufferedSession): IngestPayload {
  return {
    surface: session.surface,
    userInput: session.userInput,
    aiOutput: session.aiOutput,
    source: 'agent',
    captureMethod: session.captureMethod,
    transport: 'webhook',
    rawRequest: session.rawRequest,
    rawResponse: session.rawResponse,
    provider: session.provider,
    sessionId: session.sessionId,
    turnId: session.turnId,
    cwd: session.cwd,
    model: session.model,
    transcriptPath: session.transcriptPath,
    toolCalls: session.toolCalls,
    rawHookEvent: compactRawEvents(session.rawHookEvents),
  }
}

export function bufferAgentHook(hook: NormalizedAgentHook): BufferedAgentInteraction {
  pruneExpiredSessions()

  const key = sessionKey(hook)
  const existing = sessions.get(key)
  const next: BufferedSession = {
    provider: hook.provider,
    surface: hook.surface,
    captureMethod: hook.captureMethod,
    userInput: hook.userInput || existing?.userInput,
    aiOutput: hook.aiOutput || existing?.aiOutput,
    rawRequest: hook.rawRequest || existing?.rawRequest,
    rawResponse: hook.rawResponse || existing?.rawResponse,
    sessionId: hook.sessionId || existing?.sessionId,
    turnId: hook.turnId || existing?.turnId,
    cwd: hook.cwd || existing?.cwd,
    model: hook.model || existing?.model,
    transcriptPath: hook.transcriptPath || existing?.transcriptPath,
    toolCalls: [...(existing?.toolCalls || []), ...(hook.toolCalls || [])],
    updatedAt: Date.now(),
    rawHookEvents: compactRawEvents([...(existing?.rawHookEvents || []), hook.rawHookEvent]),
  }

  if (!next.userInput && !next.aiOutput) {
    sessions.set(key, next)
    return { ready: false, reason: 'Hook did not include prompt or response text yet.', sessionId: next.sessionId }
  }

  if (!next.userInput || !next.aiOutput) {
    sessions.set(key, next)
    return { ready: false, reason: 'Waiting for matching prompt/response event.', sessionId: next.sessionId }
  }

  sessions.delete(key)
  return { ready: true, payload: toPayload(next), sessionId: next.sessionId }
}
