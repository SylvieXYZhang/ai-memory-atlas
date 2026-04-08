import { create } from 'zustand'
import type { AppState, LogEntry, IntentType, LoadingState, NoteRecord, ResearchData, SearchResult, TemplateType, ForcedMode, PublishRecord, TranscriptHistoryItem, ParsedAction, ActionHistoryItem, ActionStatus } from './types'

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
  realtimeTranscript: '',
  transcriptHistory: [],
  
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
  
  // Action mode
  currentAction: null,
  actionHistory: [],
  
  // UI state
  activeTab: 'social',
  forcedMode: 'auto' as ForcedMode,
  logs: [],
  
  // Actions
  setIsRecording: (isRecording: boolean) => set({ isRecording }),
  setForcedMode: (forcedMode: ForcedMode) => set({ forcedMode }),
  setRecordingTime: (recordingTime: number) => set({ recordingTime }),
  setTranscript: (transcript: string) => set({ transcript }),
  setRealtimeTranscript: (realtimeTranscript: string) => set({ realtimeTranscript }),
  addTranscriptToHistory: (item: TranscriptHistoryItem) => set((state) => ({
    transcriptHistory: [item, ...state.transcriptHistory].slice(0, 20) // Keep last 20
  })),
  clearTranscriptHistory: () => set({ transcriptHistory: [] }),
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
  
  setCurrentAction: (currentAction: ParsedAction | null) => set({ currentAction }),
  addActionToHistory: (item: ActionHistoryItem) => set((state) => ({
    actionHistory: [item, ...state.actionHistory].slice(0, 30) // Keep last 30
  })),
  updateActionStatus: (actionId: string, status: ActionStatus, result?: string, error?: string) => set((state) => {
    const updateAction = (action: ParsedAction): ParsedAction => ({
      ...action,
      status,
      executionResult: result,
      executionError: error
    })
    
    return {
      currentAction: state.currentAction?.id === actionId 
        ? updateAction(state.currentAction) 
        : state.currentAction,
      actionHistory: state.actionHistory.map(item => 
        item.action.id === actionId 
          ? { ...item, action: updateAction(item.action), executedAt: Date.now() }
          : item
      )
    }
  }),
  
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
    realtimeTranscript: '',
    intent: 'unknown',
    loadingState: 'idle',
    summary: '',
    researchData: null,
    currentNote: null,
    relatedNotes: [],
    currentAction: null,
    logs: []
  })
}))
