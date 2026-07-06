import type { AgentToolCall, IngestPayload, MemoryEvent } from '@/lib/second-brain'

export type AgentHookProvider = NonNullable<MemoryEvent['provider']>

export interface AgentHookEnvelope {
  provider: AgentHookProvider
  eventName?: string
  raw: unknown
}

export interface NormalizedAgentHook {
  provider: AgentHookProvider
  surface: string
  source: 'agent'
  captureMethod: 'codex-hook' | 'claude-code-hook'
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
  rawHookEvent: unknown
}

export interface BufferedAgentInteraction {
  ready: boolean
  payload?: IngestPayload
  reason?: string
  sessionId?: string
}
