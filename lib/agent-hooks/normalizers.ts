import type { AgentToolCall } from '@/lib/second-brain'
import type { AgentHookEnvelope, AgentHookProvider, NormalizedAgentHook } from './types'

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const stringValue = asString(value)
    if (stringValue) return stringValue
  }
  return undefined
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (!isObject(current)) return undefined
    current = current[key]
  }
  return current
}

function stringifyIfUseful(value: unknown): string | undefined {
  if (typeof value === 'string') return asString(value)
  if (Array.isArray(value)) {
    const parts = value.map(stringifyIfUseful).filter(Boolean)
    return parts.length ? parts.join('\n') : undefined
  }
  if (!isObject(value)) return undefined

  const text = firstString(value.text, value.content, value.message, value.output, value.response)
  if (text) return text

  if (Array.isArray(value.content)) {
    const parts = value.content.map(stringifyIfUseful).filter(Boolean)
    return parts.length ? parts.join('\n') : undefined
  }

  return undefined
}

function messageRole(message: unknown): string | undefined {
  if (!isObject(message)) return undefined
  return asString(message.role) || asString(message.type)
}

function messageText(message: unknown): string | undefined {
  if (!isObject(message)) return stringifyIfUseful(message)
  return stringifyIfUseful(message.content) || stringifyIfUseful(message.message) || stringifyIfUseful(message.text)
}

function extractMessages(raw: unknown) {
  const candidates = [
    getPath(raw, ['messages']),
    getPath(raw, ['conversation', 'messages']),
    getPath(raw, ['payload', 'messages']),
    getPath(raw, ['transcript', 'messages']),
  ]

  const messages = candidates.find(Array.isArray)
  if (!Array.isArray(messages)) return {}

  const userMessages: string[] = []
  const assistantMessages: string[] = []

  messages.forEach((message) => {
    const role = messageRole(message)
    const text = messageText(message)
    if (!text) return
    if (role === 'user' || role === 'human' || role === 'UserPromptSubmit') userMessages.push(text)
    if (role === 'assistant' || role === 'ai' || role === 'response') assistantMessages.push(text)
  })

  return {
    userInput: userMessages.at(-1),
    aiOutput: assistantMessages.at(-1),
  }
}

function extractToolCalls(raw: unknown): AgentToolCall[] | undefined {
  const candidates = [
    getPath(raw, ['toolCalls']),
    getPath(raw, ['tool_calls']),
    getPath(raw, ['message', 'tool_calls']),
    getPath(raw, ['payload', 'tool_calls']),
  ]
  const calls = candidates.find(Array.isArray)
  if (!Array.isArray(calls)) return undefined

  const normalized = calls.flatMap((call): AgentToolCall[] => {
    if (!isObject(call)) return []
    const name = firstString(call.name, call.tool, getPath(call, ['function', 'name']))
    if (!name) return []
    return [{
      id: asString(call.id),
      name,
      input: call.input ?? call.arguments ?? getPath(call, ['function', 'arguments']),
      output: call.output ?? call.result,
      status: asString(call.status),
    }]
  })

  return normalized.length ? normalized : undefined
}

function inferProvider(raw: unknown, explicit?: unknown): AgentHookProvider {
  const candidate = asString(explicit)?.toLowerCase()
  if (candidate === 'codex') return 'codex'
  if (candidate === 'claude-code' || candidate === 'claude_code' || candidate === 'claude') return 'claude-code'

  const hookName = [
    asString(getPath(raw, ['hook_event_name'])),
    asString(getPath(raw, ['eventName'])),
    asString(getPath(raw, ['event'])),
    asString(getPath(raw, ['source'])),
  ].join(' ').toLowerCase()

  if (hookName.includes('codex')) return 'codex'
  if (hookName.includes('claude')) return 'claude-code'
  return 'unknown-agent'
}

export function createAgentHookEnvelope(raw: unknown): AgentHookEnvelope {
  const provider = inferProvider(raw, isObject(raw) ? raw.provider : undefined)
  const eventName = firstString(
    getPath(raw, ['hook_event_name']),
    getPath(raw, ['eventName']),
    getPath(raw, ['event']),
    getPath(raw, ['type']),
  )
  return { provider, eventName, raw }
}

export function normalizeAgentHook(raw: unknown): NormalizedAgentHook {
  const envelope = createAgentHookEnvelope(raw)
  const { userInput: messageUserInput, aiOutput: messageAiOutput } = extractMessages(raw)
  const provider = envelope.provider
  const captureMethod = provider === 'claude-code' ? 'claude-code-hook' : 'codex-hook'
  const surface = provider === 'claude-code' ? 'Claude Code' : provider === 'codex' ? 'Codex' : 'Agent'
  const hookInput = getPath(raw, ['hook_input']) ?? getPath(raw, ['payload']) ?? raw

  const userInput = firstString(
    getPath(raw, ['prompt']),
    getPath(raw, ['userInput']),
    getPath(raw, ['user_input']),
    getPath(raw, ['user_prompt']),
    getPath(raw, ['message', 'content']),
    getPath(raw, ['input']),
    messageUserInput,
  )

  const aiOutput = firstString(
    getPath(raw, ['aiOutput']),
    getPath(raw, ['ai_output']),
    getPath(raw, ['assistant_response']),
    getPath(raw, ['response']),
    getPath(raw, ['output']),
    getPath(raw, ['message', 'text']),
    messageAiOutput,
  )

  return {
    provider,
    surface,
    source: 'agent',
    captureMethod,
    userInput,
    aiOutput,
    rawRequest: userInput || stringifyIfUseful(hookInput),
    rawResponse: aiOutput,
    sessionId: firstString(
      getPath(raw, ['session_id']),
      getPath(raw, ['sessionId']),
      getPath(raw, ['conversation_id']),
      getPath(raw, ['conversationId']),
    ),
    turnId: firstString(getPath(raw, ['turn_id']), getPath(raw, ['turnId']), getPath(raw, ['message_id']), getPath(raw, ['messageId'])),
    cwd: firstString(getPath(raw, ['cwd']), getPath(raw, ['workspace']), getPath(raw, ['project_dir'])),
    model: firstString(getPath(raw, ['model']), getPath(raw, ['model_id']), getPath(raw, ['modelId'])),
    transcriptPath: firstString(
      getPath(raw, ['transcript_path']),
      getPath(raw, ['transcriptPath']),
      getPath(raw, ['transcript', 'path']),
    ),
    toolCalls: extractToolCalls(raw),
    rawHookEvent: raw,
  }
}
