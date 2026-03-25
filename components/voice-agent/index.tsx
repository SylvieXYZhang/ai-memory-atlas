'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Settings, Volume2, FileText, Lightbulb, FlaskConical } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { VoiceRecorder } from './voice-recorder'
import { DebugPanel } from './debug-panel'
import { ResultTabs } from './result-tabs'
import { NoteDisplay } from './note-display'
import { HistoryPanel } from './history-panel'
import { MagicButton } from './magic-button'
import { SettingsPortal } from './settings-portal'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// Services
import { transcribeAudio, mockTranscribeAudio } from '@/lib/services/asr'
import { detectIntent, generateSummary, performDeepResearch } from '@/lib/services/llm'
import { searchSimilarNotes } from '@/lib/services/vector-search'
import { getNotes, saveNote, seedDemoNotes } from '@/lib/services/storage'
import type { TemplateData, PublishRecord } from '@/lib/types'
import { 
  type UserAPIConfig, 
  loadAPIConfig, 
  getAPIKey, 
  getAssignment,
  getUnconfiguredFunctions,
  type FunctionType
} from '@/lib/api-config'

const PUBLISH_HISTORY_KEY = 'voiceagent_publish_history'

export function VoiceAgent() {
  const store = useAppStore()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [apiConfig, setApiConfig] = useState<UserAPIConfig | null>(null)
  const [isPublishingNote, setIsPublishingNote] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Load API config and notes on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const config = loadAPIConfig()
      setApiConfig(config)
      store.setNotes(getNotes())
      
      // Load publish history
      const saved = localStorage.getItem(PUBLISH_HISTORY_KEY)
      if (saved) {
        try {
          store.setPublishHistory(JSON.parse(saved))
        } catch (error) {
          console.error('[v0] Error loading publish history:', error)
        }
      }
    }
  }, [])

  // Recording timer
  useEffect(() => {
    if (store.isRecording) {
      timerRef.current = setInterval(() => {
        store.setRecordingTime(store.recordingTime + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [store.isRecording, store.recordingTime])

  // Helper to get API key for a specific function
  const getKeyForFunction = useCallback((func: FunctionType): string => {
    if (!apiConfig) return ''
    const assignment = getAssignment(apiConfig, func)
    return getAPIKey(apiConfig, assignment.provider)
  }, [apiConfig])

  const handleStartRecording = useCallback(() => {
    store.reset()
    store.setIsRecording(true)
    store.setLoadingState('recording')
    store.addLog('Recording started', 'info')
  }, [])

  const handleStopRecording = useCallback(async (audioBlob: Blob) => {
    store.setIsRecording(false)
    store.setLoadingState('transcribing')
    store.addLog(`Recording stopped (${store.recordingTime}s)`, 'info')
    store.addLog('Starting transcription...', 'info')

    try {
      // Transcribe audio
      let transcript: string
      const asrKey = getKeyForFunction('asr')
      if (asrKey) {
        transcript = await transcribeAudio(audioBlob, asrKey)
      } else {
        store.addLog('No ASR API key - using demo mode', 'warning')
        transcript = await mockTranscribeAudio(store.recordingTime * 1000)
      }
      
      store.setTranscript(transcript)
      store.addLog(`Transcription complete: "${transcript.slice(0, 50)}..."`, 'success')

      // Resolve intent — respect manual override, fall back to AI detection
      let intent: 'note' | 'publish'
      const forcedMode = store.forcedMode
      if (forcedMode === 'note') {
        intent = 'note'
        store.addLog('Mode: Note (manual)', 'info')
      } else if (forcedMode === 'publish') {
        intent = 'publish'
        store.addLog('Mode: Publish (manual)', 'info')
      } else {
        store.setLoadingState('analyzing')
        store.addLog('Detecting intent automatically...', 'info')
        const intentKey = getKeyForFunction('intent')
        const detected = await detectIntent(transcript, intentKey)
        intent = detected === 'note' ? 'note' : 'publish'
        store.addLog(`Intent detected: ${intent}`, 'success')
      }
      store.setIntent(intent)

      if (intent === 'note') {
        // Note flow — save the verbatim transcript, no summarisation
        store.setLoadingState('saving-note')
        store.addLog('Saving verbatim note...', 'info')
        
        const note = saveNote(transcript)     // exact words, no processing
        const notes = getNotes()
        store.setNotes(notes)
        store.setCurrentNote(note)
        
        // Find semantically related notes from the knowledge base
        const related = searchSimilarNotes(transcript, notes, note.id)
        store.setRelatedNotes(related)
        
        store.addLog(
          `Note saved (${transcript.split(/\s+/).length} words). ${related.length} semantic connection${related.length !== 1 ? 's' : ''} found.`,
          'success'
        )
        store.setLoadingState('complete')
      } else {
        // Publish flow
        store.setLoadingState('generating-summary')
        store.addLog('Generating quick summary...', 'info')
        
        const summaryKey = getKeyForFunction('summary')
        const summary = await generateSummary(transcript, summaryKey)
        store.setSummary(summary)
        store.addLog('Summary generated', 'success')
        
        // Save publish record
        const record: PublishRecord = {
          id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          transcript,
          summary,
          research: null,
          timestamp: Date.now(),
          createdAt: new Date().toLocaleString()
        }
        store.addPublishRecord(record)
        const updated = [record, ...store.publishHistory].slice(0, 50)
        localStorage.setItem(PUBLISH_HISTORY_KEY, JSON.stringify(updated))
        
        store.setLoadingState('complete')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      store.addLog(`Error: ${message}`, 'error')
      store.setLoadingState('error')
    }
  }, [store.recordingTime])

  const handleDeepResearch = useCallback(async () => {
    if (!store.transcript) return

    store.setLoadingState('deep-research')
    store.addLog('Starting deep research with web search...', 'info')
    store.addLog('This may take 30-60 seconds...', 'warning')

    try {
      const researchKey = getKeyForFunction('research')
      const research = await performDeepResearch(store.transcript, researchKey)
      store.setResearchData(research)
      store.addLog('Deep research complete!', 'success')
      store.setLoadingState('complete')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      store.addLog(`Research error: ${message}`, 'error')
      store.setLoadingState('error')
    }
  }, [store.transcript])

  const handleConfigChange = useCallback((newConfig: UserAPIConfig) => {
    setApiConfig(newConfig)
    const unconfigured = getUnconfiguredFunctions(newConfig)
    if (unconfigured.length === 0) {
      store.addLog('All API functions configured!', 'success')
    } else {
      store.addLog(`${4 - unconfigured.length}/4 functions configured`, 'info')
    }
  }, [])

  const handleLoadDemoNotes = useCallback(() => {
    const notes = seedDemoNotes()
    store.setNotes(notes)
    store.addLog(`Loaded ${notes.length} demo notes with semantic overlap`, 'success')
    store.addLog('Try saying something about AI, startups, or note-taking to see connections!', 'info')
  }, [])

  // Save a publish record and persist to localStorage
  const savePublishRecord = useCallback((record: PublishRecord) => {
    store.addPublishRecord(record)
    const updated = [record, ...store.publishHistory].slice(0, 50)
    localStorage.setItem(PUBLISH_HISTORY_KEY, JSON.stringify(updated))
  }, [store.publishHistory])

  // Publish a note — runs the publish flow on a note's text
  const handlePublishNote = useCallback(async (noteId: string) => {
    const note = store.notes.find(n => n.id === noteId)
    if (!note) return

    setIsPublishingNote(true)
    store.addLog(`Publishing note ${noteId.slice(0, 8)}...`, 'info')

    try {
      // Generate summary for the note
      const summaryKey = getKeyForFunction('summary')
      const summary = await generateSummary(note.text, summaryKey)
      
      // Create publish record
      const record: PublishRecord = {
        id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        transcript: note.text,
        summary,
        research: null,
        timestamp: Date.now(),
        createdAt: new Date().toLocaleString(),
        sourceNoteId: noteId
      }
      
      savePublishRecord(record)
      store.addLog('Note published as draft!', 'success')
      
      // Switch to publish view
      store.setIntent('publish')
      store.setTranscript(note.text)
      store.setSummary(summary)
      store.setLoadingState('complete')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      store.addLog(`Publish error: ${message}`, 'error')
    } finally {
      setIsPublishingNote(false)
    }
  }, [store.notes, savePublishRecord])

  const isProcessing = ['transcribing', 'analyzing', 'generating-summary', 'saving-note'].includes(store.loadingState)
  const isDeepResearching = store.loadingState === 'deep-research'
  const showPublishResult = store.intent === 'publish' && store.summary && store.loadingState === 'complete'
  const showNoteResult = store.intent === 'note' && store.currentNote && store.loadingState === 'complete'

  const templateData: TemplateData = {
    topic: store.transcript,
    summary: store.summary,
    research: store.researchData || undefined
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">VoiceAgent</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Research Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadDemoNotes}
              className="gap-2"
            >
              <FlaskConical className="w-4 h-4" />
              <span className="hidden sm:inline">Load Demo Notes</span>
            </Button>

            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>API Settings</DialogTitle>
                  <DialogDescription>
                    Configure API keys and model assignments for each function.
                  </DialogDescription>
                </DialogHeader>
                <SettingsPortal 
                  onConfigChange={handleConfigChange}
                  onClose={() => setSettingsOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero section */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-balance">
              Your Voice, Your Research
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto text-pretty">
              Speak freely. In Publish Mode the AI researches and drafts content. 
              In Note Mode your exact words are saved and automatically linked to semantically related ideas.
            </p>
          </div>

          {/* Mode selector */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 p-1 rounded-full bg-secondary border border-border">
              {/* Auto */}
              <button
                onClick={() => store.setForcedMode('auto')}
                disabled={store.isRecording || isProcessing}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
                  store.forcedMode === 'auto'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Auto
              </button>
              {/* Publish */}
              <button
                onClick={() => store.setForcedMode('publish')}
                disabled={store.isRecording || isProcessing}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
                  store.forcedMode === 'publish'
                    ? "bg-research text-research-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Publish
              </button>
              {/* Note */}
              <button
                onClick={() => store.setForcedMode('note')}
                disabled={store.isRecording || isProcessing}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
                  store.forcedMode === 'note'
                    ? "bg-note text-note-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Note
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {store.forcedMode === 'auto'
                ? "AI will detect mode from your speech"
                : store.forcedMode === 'publish'
                ? "Every recording will be processed for publishing"
                : "Every recording will be saved as a verbatim note"}
            </p>
          </div>

          {/* Voice recorder */}
          <div className="flex justify-center py-8">
            <VoiceRecorder
              isRecording={store.isRecording}
              recordingTime={store.recordingTime}
              isProcessing={isProcessing}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
            />
          </div>

          {/* Transcript display */}
          {store.transcript && (
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Transcript:</p>
              <p className="text-foreground">{store.transcript}</p>
            </div>
          )}

          {/* Publish results */}
          {showPublishResult && (
            <div className="space-y-6">
              {/* Quick summary */}
              {!store.researchData && (
                <div className="p-6 rounded-lg bg-research/5 border border-research/30">
                  <h3 className="text-lg font-semibold text-research mb-3">Quick Summary</h3>
                  <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{store.summary}</p>
                </div>
              )}

              {/* Magic button for deep research */}
              {!store.researchData && (
                <div className="flex justify-center">
                  <MagicButton
                    onClick={handleDeepResearch}
                    isLoading={isDeepResearching}
                  />
                </div>
              )}

              {/* Deep research results */}
              {store.researchData && (
                <ResultTabs
                  data={templateData}
                  activeTab={store.activeTab}
                  onTabChange={store.setActiveTab}
                />
              )}
            </div>
          )}

          {/* Note results */}
          {showNoteResult && (
            <NoteDisplay
              currentNote={store.currentNote}
              relatedNotes={store.relatedNotes}
              onPublish={handlePublishNote}
              isPublishing={isPublishingNote}
            />
          )}

          {/* Deep research loading state */}
          {isDeepResearching && (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-research/10 border border-research/30">
                <div className="w-2 h-2 rounded-full bg-research animate-pulse" />
                <span className="text-research font-medium">Conducting deep research with web search...</span>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                This may take 30-60 seconds. Please wait...
              </p>
            </div>
          )}

          {/* History panel */}
          <HistoryPanel
            notes={store.notes}
            publishHistory={store.publishHistory}
            onPublishNote={handlePublishNote}
            isPublishing={isPublishingNote}
          />

          {/* Debug panel */}
          <DebugPanel
            logs={store.logs}
            onClear={store.clearLogs}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          VoiceAgent MVP - Voice-powered AI Research Assistant
        </div>
      </footer>
    </div>
  )
}
