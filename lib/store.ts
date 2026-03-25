import { create } from 'zustand'
import type { AppState, LogEntry, IntentType, LoadingState, NoteRecord, ResearchData, SearchResult, TemplateType, ForcedMode, PublishRecord } from './types'

const formatTime = () => {
  return new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  })
}

export const useAppStore = create<AppState>((set, get) => ({
  // Recording
  isRecording: false,
  recordingTime: 0,
  
  // Transcription
  transcript: '',
  
  // Intent
  intent: 'unknown',
  
  // Loading states
  loadingState: 'idle',
  
  // Research results
  summary: '',
  researchData: null,
  
  // Notes
  notes: [],
  currentNote: null,
  relatedNotes: [],
  
  // Publish history
  publishHistory: [],
  
  // UI state
  activeTab: 'social',
  forcedMode: 'auto' as ForcedMode,
  logs: [],
  
  // Actions
  setIsRecording: (isRecording: boolean) => set({ isRecording }),
  setForcedMode: (forcedMode: ForcedMode) => set({ forcedMode }),
  setRecordingTime: (recordingTime: number) => set({ recordingTime }),
  setTranscript: (transcript: string) => set({ transcript }),
  setIntent: (intent: IntentType) => set({ intent }),
  setLoadingState: (loadingState: LoadingState) => set({ loadingState }),
  setSummary: (summary: string) => set({ summary }),
  setResearchData: (researchData: ResearchData | null) => set({ researchData }),
  setNotes: (notes: NoteRecord[]) => set({ notes }),
  setCurrentNote: (currentNote: NoteRecord | null) => set({ currentNote }),
  setRelatedNotes: (relatedNotes: SearchResult[]) => set({ relatedNotes }),
  setActiveTab: (activeTab: TemplateType) => set({ activeTab }),
  
  addPublishRecord: (record: PublishRecord) => set((state) => ({
    publishHistory: [record, ...state.publishHistory].slice(0, 50) // Keep last 50
  })),
  setPublishHistory: (publishHistory: PublishRecord[]) => set({ publishHistory }),
  
  addLog: (message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      timestamp: formatTime(),
      message,
      type
    }
    set((state) => ({ 
      logs: [...state.logs, entry].slice(-50) // Keep last 50 logs
    }))
  },
  
  clearLogs: () => set({ logs: [] }),
  
  reset: () => set({
    isRecording: false,
    recordingTime: 0,
    transcript: '',
    intent: 'unknown',
    loadingState: 'idle',
    summary: '',
    researchData: null,
    currentNote: null,
    relatedNotes: [],
    logs: []
  })
}))
