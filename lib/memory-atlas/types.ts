import type { MemoryRepresentation, PromptPurpose } from './prompt-classifier'

export type MemoryNodeType =
  | 'project'
  | 'idea'
  | 'decision'
  | 'task'
  | 'artifact'
  | 'question'
  | 'preference'
  | 'failure'
  | 'tool'
  | 'person'

export type MemoryEdgeType =
  | 'belongs_to'
  | 'generated_from'
  | 'led_to'
  | 'supports'
  | 'contradicts'
  | 'resolved_by'
  | 'revisited_in'

export interface MockAiChat {
  id: string
  surface: string
  title: string
  userMessage: string
  aiMessage: string
  capturedAt: string
  projectId: string
  extractedNodeIds: string[]
  sessionId?: string
  turnId?: string
  cwd?: string
  model?: string
  transcriptPath?: string
  provider?: 'codex' | 'claude-code' | 'unknown-agent'
  promptPurpose?: PromptPurpose
  memoryRepresentation?: MemoryRepresentation
  boundarySignals?: string[]
}

export interface MemoryNode {
  id: string
  type: MemoryNodeType
  title: string
  summary: string
  evidence: string[]
  confidence: number
  createdAt: string
  updatedAt: string
  x: number
  y: number
  sourceChatIds: string[]
}

export interface MemoryEdge {
  id: string
  from: string
  to: string
  type: MemoryEdgeType
  evidence?: string
}

export interface TimelineMoment {
  id: string
  date: string
  title: string
  description: string
  nodeIds: string[]
}

export interface AtlasProject {
  id: string
  title: string
  summary: string
  status: string
  decisionIds: string[]
  taskIds: string[]
  artifactIds: string[]
  questionIds: string[]
}

export type MemoryCandidateStatus = 'pending' | 'accepted' | 'rejected'

export interface MemoryCandidate {
  id: string
  eventId: string
  status: MemoryCandidateStatus
  surface: string
  title: string
  type: MemoryNodeType
  summary: string
  evidence: string[]
  confidence: number
  promptPurpose: PromptPurpose
  memoryRepresentation: MemoryRepresentation
  boundarySignals: string[]
  createdAt: string
  sourceChat: MockAiChat
}

export interface MemoryCandidateReview {
  id: string
  status: MemoryCandidateStatus
  title?: string
  type?: MemoryNodeType
  summary?: string
  updatedAt: number
}
