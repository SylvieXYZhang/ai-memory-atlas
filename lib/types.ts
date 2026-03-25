// Type definitions for VoiceAgent MVP

export interface NoteRecord {
  id: string
  text: string
  timestamp: number
  createdAt: string
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

export type IntentType = 'publish' | 'note' | 'unknown'

export type ForcedMode = 'auto' | 'publish' | 'note'

export type LoadingState = 
  | 'idle' 
  | 'recording' 
  | 'transcribing' 
  | 'analyzing' 
  | 'generating-summary'
  | 'deep-research'
  | 'saving-note'
  | 'complete'
  | 'error'

export type TemplateType = 'social' | 'blog' | 'report'

export interface LogEntry {
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

export interface AppState {
  // Recording
  isRecording: boolean
  recordingTime: number
  
  // Transcription
  transcript: string
  
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
  
  // UI state
  activeTab: TemplateType
  forcedMode: ForcedMode
  logs: LogEntry[]
  
  // Actions
  setIsRecording: (isRecording: boolean) => void
  setForcedMode: (mode: ForcedMode) => void
  setRecordingTime: (time: number) => void
  setTranscript: (transcript: string) => void
  setIntent: (intent: IntentType) => void
  setLoadingState: (state: LoadingState) => void
  setSummary: (summary: string) => void
  setResearchData: (data: ResearchData | null) => void
  setNotes: (notes: NoteRecord[]) => void
  setCurrentNote: (note: NoteRecord | null) => void
  setRelatedNotes: (notes: SearchResult[]) => void
  setActiveTab: (tab: TemplateType) => void
  addLog: (message: string, type: LogEntry['type']) => void
  clearLogs: () => void
  reset: () => void
}
