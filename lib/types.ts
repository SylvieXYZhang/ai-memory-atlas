// Type definitions for VoiceAgent MVP

export interface NoteRecord {
  id: string
  text: string
  timestamp: number
  createdAt: string
}

export interface PublishRecord {
  id: string
  transcript: string
  summary: string
  research: ResearchData | null
  timestamp: number
  createdAt: string
  sourceNoteId?: string // if published from a note
}

export interface SearchResult {
  note: NoteRecord
  similarity: number
}

export interface ResearchData {
  marketOverview: string
  keyPlayers: string[]
  trends: string[]
  conclusion: string
  sources: string[]
}

export interface TemplateData {
  topic: string
  summary: string
  research?: ResearchData
}

export type IntentType = 'publish' | 'note' | 'action' | 'unknown'

export type ForcedMode = 'auto' | 'publish' | 'note' | 'action'

// Action Mode Types
export type ActionCategory = 'calendar' | 'reminder' | 'task' | 'timer' | 'unknown'
export type ActionStatus = 'pending' | 'confirmed' | 'executed' | 'cancelled' | 'failed'
export type CalendarOperation = 'add' | 'modify' | 'delete' | 'list'

export interface ParsedAction {
  id: string
  category: ActionCategory
  title: string
  description: string
  originalText: string
  timestamp: number
  status: ActionStatus
  
  // Calendar specific
  calendarOperation?: CalendarOperation
  calendarEventId?: string  // For modify/delete operations
  eventDate?: string
  eventTime?: string
  eventEndTime?: string
  eventLocation?: string
  
  // Reminder specific
  reminderTime?: string
  
  // Task specific
  taskPriority?: 'low' | 'medium' | 'high'
  taskDueDate?: string
  
  // Timer specific
  timerDuration?: number // in minutes
  
  // Execution result
  executionResult?: string
  executionError?: string
}

export interface ActionHistoryItem {
  action: ParsedAction
  executedAt?: number
}

export type LoadingState = 
  | 'idle' 
  | 'recording' 
  | 'transcribing' 
  | 'analyzing' 
  | 'generating-summary'
  | 'deep-research'
  | 'saving-note'
  | 'parsing-action'
  | 'executing-action'
  | 'complete'
  | 'error'

export type TemplateType = 'social' | 'blog' | 'report'

export interface LogEntry {
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

export interface TranscriptHistoryItem {
  id: string
  text: string
  timestamp: number
  intent: IntentType
}

export interface AppState {
  // Recording
  isRecording: boolean
  recordingTime: number
  
  // Transcription
  transcript: string
  realtimeTranscript: string
  transcriptHistory: TranscriptHistoryItem[]
  
  // Intent
  intent: IntentType
  
  // Loading states
  loadingState: LoadingState
  
  // Research results
  summary: string
  researchData: ResearchData | null
  
  // Notes
  notes: NoteRecord[]
  currentNote: NoteRecord | null
  relatedNotes: SearchResult[]
  
  // Publish history
  publishHistory: PublishRecord[]
  
  // Action mode
  currentAction: ParsedAction | null
  actionHistory: ActionHistoryItem[]
  
  // UI state
  activeTab: TemplateType
  forcedMode: ForcedMode
  logs: LogEntry[]
  
  // Actions
  setIsRecording: (isRecording: boolean) => void
  setForcedMode: (mode: ForcedMode) => void
  setRecordingTime: (time: number) => void
  setTranscript: (transcript: string) => void
  setRealtimeTranscript: (transcript: string) => void
  addTranscriptToHistory: (item: TranscriptHistoryItem) => void
  clearTranscriptHistory: () => void
  setIntent: (intent: IntentType) => void
  setLoadingState: (state: LoadingState) => void
  setSummary: (summary: string) => void
  setResearchData: (data: ResearchData | null) => void
  setNotes: (notes: NoteRecord[]) => void
  setCurrentNote: (note: NoteRecord | null) => void
  setRelatedNotes: (notes: SearchResult[]) => void
  setActiveTab: (tab: TemplateType) => void
  addPublishRecord: (record: PublishRecord) => void
  setPublishHistory: (history: PublishRecord[]) => void
  setCurrentAction: (action: ParsedAction | null) => void
  addActionToHistory: (item: ActionHistoryItem) => void
  updateActionStatus: (actionId: string, status: ActionStatus, result?: string, error?: string) => void
  addLog: (message: string, type: LogEntry['type']) => void
  clearLogs: () => void
  reset: () => void
}
